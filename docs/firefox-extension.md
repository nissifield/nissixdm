# Firefox companion extension for NissiXDM

Use the Firefox extension in this repository with the NissiXDM/XDM 9 Fedora
build. Older store add-ons target different XDM generations.

Firefox 142 or later is required by the manifest. This fork's development
archive is unsigned; it is not a permanently installable Mozilla-signed XPI.

## Test the companion extension

1. Download xdm-firefox-1.0.1.zip and FIREFOX-SHA256SUMS from the Fedora test release.
2. Verify it with `sha256sum -c FIREFOX-SHA256SUMS`, then extract the ZIP.
3. In Firefox, open `about:debugging#/runtime/this-firefox`.
4. Choose **Load Temporary Add-on** and select the extracted manifest.json.
5. Start the installed NissiXDM app and open the extension's toolbar popup.
6. Confirm it connects, then try a small ZIP download. A matching file type should
   appear in NissiXDM's queue; disabling monitoring should leave downloads in Firefox.
7. Stop NissiXDM and confirm the extension reports it disconnected. Start it again
   and reopen the popup after a few seconds.

Temporarily disable older XDM monitor add-ons while testing to avoid two add-ons
trying to intercept the same download. Temporary extensions are removed when
Firefox restarts. Normal permanent distribution requires Mozilla signing:
https://extensionworkshop.com/documentation/publish/signing-and-distribution-overview/

## Connection changes in 1.0.1

Concurrent status requests share the pending lookup. Non-poll requests have a
three-second timeout; a long poll has thirty seconds, longer than the app's
twenty-second hold. Only a successful response with XDM configuration enables
interception. Poll errors mark the connection disconnected and retry after a
delay rather than looping immediately.

## Checks

```sh
node --test browser-extension/tests/firefox-connector.test.cjs
browser-extension/package-firefox.sh
```

The tests exercise connection startup, overlapping popup requests, invalid and
HTTP-error responses, aborts, poll backoff, shutdown, commands, and app restarts.
The packaging script runs Mozilla web-ext lint before building the ZIP.

These tests use mocked HTTP responses. They do not establish behavior in a
running Firefox/Fedora desktop or provide a Mozilla signature.
