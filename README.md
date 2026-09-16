# Spicetify Playlist Age

A lightweight Spicetify extension that displays an estimated playlist creation date together with its precise calendar age.

Example:

```text
21 April 2022 (4 tahun, 4 bulan, 26 hari yang lalu)
## How it works

Spotify does not expose an official playlist creation date.

This extension uses the oldest available `addedAt` timestamp from the playlist items as an estimate of when the playlist began.

Because of this, the displayed date may be newer than the actual creation date if the earliest tracks were removed.

## Features

- Estimated playlist creation date
- Precise years, months, and days
- Indonesian date formatting
- Calendar-aware age calculation
- Works locally inside Spotify
- No API key
- No analytics
- No tracking
- No external server

## Requirements

- Spotify Desktop
- Spicetify CLI

## Installation

Copy `playlistCreatedDate.js` into:

`~/.config/spicetify/Extensions/`

Then run:

`spicetify config extensions playlistCreatedDate.js`

`spicetify apply`

Restart Spotify.

## Limitations

The displayed date is an estimate based on the oldest available playlist-item timestamp.

It is not an official Spotify playlist creation timestamp.

The extension uses internal Spotify APIs exposed through Spicetify, which may change between Spotify versions.

## License

MIT License.

Copyright © 2026 Farazzmaldi.