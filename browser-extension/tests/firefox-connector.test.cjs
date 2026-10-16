"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const sourcePath = process.env.FIREFOX_CONNECTOR_SOURCE ||
    path.join(__dirname, "../firefox-extension/app/connector.js");
const source = fs.readFileSync(sourcePath, "utf8");
const config = (overrides = {}) => ({
    enabled: true, fileExts: ["zip"], videoList: [], version: 1, instanceId: "one", ...overrides
});
const response = (body, status = 200) => ({
    ok: status >= 200 && status < 300, status, json: async () => body
});
const parked = () => new Promise(() => {});

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

function harness(fetch) {
    const timers = [];
    const signals = [];
    const messages = [];
    let disconnects = 0;
    const context = vm.createContext({
        Logger: class { log() {} },
        crypto: { randomUUID: () => "test-client" },
        fetch,
        AbortSignal: {
            timeout(milliseconds) {
                const controller = new AbortController();
                signals.push({ milliseconds, controller });
                return controller.signal;
            }
        },
        setInterval() {},
        setTimeout(callback, milliseconds) { timers.push({ callback, milliseconds }); },
        Date
    });
    const Connector = vm.runInContext(source + "\nConnector", context);
    const connector = new Connector(
        message => messages.push(message), () => { disconnects++; }
    );
    return { connector, timers, signals, messages, disconnects: () => disconnects };
}

test("popup and startup wait for the same lookup and its JSON body", async () => {
    const headers = deferred();
    const body = deferred();
    const calls = [];
    const h = harness((url) => {
        calls.push(url);
        return url.endsWith("/sync") ? headers.promise : parked();
    });
    const startup = h.connector.tryConnect("startup");
    const popup = h.connector.tryConnect("popup");
    assert.strictEqual(popup, startup);
    headers.resolve({ ok: true, status: 200, json: () => body.promise });
    await Promise.resolve();
    assert.equal(h.connector.isConnected(), undefined);
    assert.equal(calls.filter(url => url.endsWith("/poll")).length, 0);
    body.resolve(config());
    await popup;
    assert.equal(h.connector.isConnected(), true);
    assert.equal(h.messages.length, 1);
    assert.equal(calls.filter(url => url.endsWith("/poll")).length, 1);
});

test("HTTP failures never enable interception or start polling", async () => {
    const calls = [];
    const h = harness(async url => { calls.push(url); return response(config(), 503); });
    await h.connector.tryConnect("startup");
    assert.equal(h.connector.isConnected(), false);
    assert.equal(h.messages.length, 0);
    assert.equal(h.disconnects(), 1);
    assert.equal(calls.length, 1);
});

test("unrelated JSON and malformed replies are rejected before polling", async () => {
    for (const body of [null, {}, { enabled: true }, { enabled: true, fileExts: "zip" }]) {
        const calls = [];
        const h = harness(async url => { calls.push(url); return response(body); });
        await h.connector.tryConnect("startup");
        assert.equal(h.connector.isConnected(), false);
        assert.equal(h.messages.length, 0);
        assert.equal(calls.length, 1);
    }
    const h = harness(async () => ({
        ok: true, status: 200, json: async () => { throw new SyntaxError("invalid JSON"); }
    }));
    await h.connector.tryConnect("startup");
    assert.equal(h.connector.isConnected(), false);
    assert.equal(h.connector.polling, false);
});

test("a stalled lookup aborts and lets waiting popup requests finish", async () => {
    const h = harness((url, options) => new Promise((resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(new Error("timeout")));
    }));
    const pending = h.connector.tryConnect("popup");
    assert.equal(h.signals[0].milliseconds, 3000);
    h.signals[0].controller.abort();
    await pending;
    assert.equal(h.connector.isConnected(), false);
    assert.equal(h.connector.attempt, undefined);
});

test("a failed poll disconnects and backs off instead of reconnecting in a hot loop", async () => {
    const calls = [];
    const h = harness(async url => { calls.push(url); return response(null, 503); });
    h.connector.connected = true;
    h.connector.polling = true;
    await h.connector.pollOnce();
    assert.equal(h.connector.isConnected(), false);
    assert.equal(h.connector.polling, false);
    assert.equal(calls.length, 1);
    assert.equal(h.timers.length, 1);
    assert.ok(h.timers[0].milliseconds >= 5000);
});

test("an empty poll stays connected and respects the minimum poll interval", async () => {
    const h = harness(async () => response(null, 204));
    h.connector.connected = true;
    h.connector.polling = true;
    await h.connector.pollOnce();
    assert.equal(h.connector.isConnected(), true);
    assert.equal(h.timers.length, 1);
    assert.ok(h.timers[0].milliseconds > 0);
    assert.ok(h.timers[0].milliseconds <= 1000);
    assert.equal(h.signals[0].milliseconds, 30000);
});

test("a shutdown reply disconnects without scheduling another poll", async () => {
    const h = harness(async () => response({ bye: true }));
    h.connector.connected = true;
    h.connector.polling = true;
    await h.connector.pollOnce();
    assert.equal(h.connector.isConnected(), false);
    assert.equal(h.timers.length, 0);
});

test("commands report HTTP rejection and have a bounded wait", async () => {
    const h = harness(async () => response(config(), 500));
    h.connector.connected = true;
    await h.connector.postMessage("/batch", { groups: [] });
    assert.equal(h.connector.isConnected(), false);
    assert.equal(h.messages.length, 0);
    assert.equal(h.signals[0].milliseconds, 3000);
});

test("restarting XDM accepts its lower state version", () => {
    const h = harness(parked);
    h.connector.applyMessage(config({ version: 20, instanceId: "old" }));
    h.connector.applyMessage(config({ version: 1, instanceId: "new" }));
    assert.equal(h.connector.version, 1);
    assert.equal(h.connector.instanceId, "new");
    assert.equal(h.messages.length, 2);
    assert.equal(h.connector.isConnected(), true);
});
