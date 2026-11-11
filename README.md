# Digital Signage Ads Rotation

A drop-in HTML5 package that plays **a different ad each time your playlist loops**.

```
Loop 1:  Item A → Item B → Item C → Ad 1
Loop 2:  Item A → Item B → Item C → Ad 2
Loop 3:  Item A → Item B → Item C → Ad 3
Loop 4:  Item A → Item B → Item C → Ad 1   ← starts again
```

No coding, no server and no internet connection needed. Unzip it, drop your ads in a folder, zip it
again and add it to your playlist.

**Guide:** [Digital Signage Ad Rotation: Play a Different Ad Every Playlist Loop](https://easysignage.com/blog/26/digital-signage-ad-rotation/) explains how
to plan an ad slot, how often each ad plays, and how to prepare ad files that work on screens.

---

## Why use it

Most digital signage playlists play every item on every loop. That works for content, but ads often
need to **share one slot**:

- **Several sponsors, one slot.** A gym, café or venue has three sponsors but only wants one ad break
  per loop. Each sponsor gets every third loop.
- **Fresh content without a longer playlist.** Rotate promotions, offers or announcements through a
  single position, so the loop stays short and viewers see something new each time.
- **No duplicate playlists.** Without rotation you'd build one playlist per ad and switch between them
  with channels or schedules. Here it's one playlist and one item, and it still works with your
  existing schedules.

---

## Download

Grab the zip from the [`dist`](dist) folder (or the Releases page):

| File | What it is |
|---|---|
| `ad-rotator.zip` | The package with an empty `ads` folder, ready for your ads. |
| `ad-rotator-demo.zip` | The same package with two sample ads, to try it before adding your own. |

---

## Quick start

Prefer a printable version? See the **[Ad Rotator quick guide (PDF)](docs/Ad-Rotator-Guide.pdf)**, with screenshots for Mac and Windows.

### 1. Unzip it

You'll see:

```
ad-rotator/
├── ads/               ← PUT YOUR ADS HERE
├── app/               the app itself, no need to open it
├── index.html         leave this file where it is
└── HOW-TO-USE.txt     the same steps as below
```

### 2. Add your ads

Copy your ads into `ads/` and **rename them by play order**:

```
ads/
├── 01.jpg
├── 02.mp4
└── 03.png
```

- **Images:** `jpg`, `jpeg`, `png`, `webp`, `gif`, `svg`
- **Videos:** `mp4`, `webm`, `mov`, `m4v` (they play muted). See [Supported files](#supported-files).
- Number them **with no gaps**: 01, 02, 03. If `03` is missing, `04` and later never play.
- **One file per number.** If there are two (say `01.jpg` and `01.png`), only one of them plays.
- The leading `0` keeps files in play order in Finder and Explorer. `1`, `2`, `3` and `001`, `002`, `003` work too, up to 999 ads.
- You can delete `PUT-YOUR-ADS-HERE.txt`.

### 3. Zip it again

Open the folder, **select everything inside it**, and compress the selection:

- **Mac:** right-click → *Compress*
- **Windows:** right-click → *Send to* → *Compressed (zipped) folder*

> **Important:** zip the *contents*, not the folder. `index.html` has to be at the top level of the
> zip. Zipping the folder itself puts everything one level down, and most signage platforms then
> reject it with an error like *"index.html not found at the root of the zip file"*.

### 4. Add it to your playlist

1. Upload the zip to your playlist as an **HTML5 package** (in EasySignage, upload it like any other
   file).
2. Wait for it to finish validating.
3. Set the item's **duration** to the length of your ads (the longest one if they differ).
4. Publish to your screens.

That's it. Each time the playlist reaches the item, the next ad plays.

---

## Supported files

| Type | Works | Watch out for |
|---|---|---|
| **JPG / JPEG** | Any normal JPEG, including `.JPG` from cameras | Phone photos can show sideways on older players, which ignore the rotation stored in the photo. Very large photos (over about 4000 px wide) can be slow on low-end players. Resize them to your screen size. |
| **PNG** | Any PNG, including transparency | Transparent areas show the `background` colour (black by default). |
| **MP4** | MP4 encoded with **H.264** video, the most common format | MP4 is only a container. **H.265/HEVC** (the default on recent iPhones) plays only on players with hardware support, so it may be black on some screens. 4K or 60 fps can stutter on low-end players. Re-encode as H.264, 1080p, 30 fps to be safe. |
| WEBP, GIF, SVG | Yes | GIFs animate. |
| MOV, M4V, WEBM | Usually | Same codec rule as MP4. MOV files from iPhones are often HEVC. |
| HEIC, TIFF, BMP, AVI, WMV, MKV | **No** | Convert to JPG, PNG or MP4 first. |

Your signage platform also checks each file when you upload the zip. A file whose extension doesn't
match its real type (for example a JPEG renamed to `.png`) can be rejected.

---

## How it works

1. The screen opens `index.html` every time the playlist reaches the item.
2. The app remembers, on that screen, which ad is next and its exact file, using the browser's
   `localStorage`, and shows it straight away. There's no searching at start, so the ad appears with
   no blank gap.
3. While the ad plays, the app looks up the following ad in `ads/`, trying each supported file type,
   and saves it for the next loop.
4. If that number doesn't exist, the rotation has passed the last ad, so it goes back to `01`.
5. If a player keeps the page open between loops instead of reloading it, the app moves to the next ad
   when the page comes back into view.

The very first play on a screen has to search for ad `01`, so it can take a moment longer.

Because each screen keeps its own counter:

- Screens rotate independently. They aren't synchronised with each other.
- The rotation carries on after a reboot.
- Two Ad Rotators in the same playlist each keep their own place.
- Uploading a new version starts the rotation again from ad 1.

Everything is in the zip, so it plays offline.

---

## Settings (optional)

You don't need to change anything to use it. If you want to, open `app/settings.js` in any text
editor:

| Setting | Options | Default | What it does |
|---|---|---|---|
| `fit` | `"contain"`, `"cover"` | `"contain"` | `contain` shows the whole ad, with bars if its shape differs from the screen. `cover` fills the screen and crops the edges. |
| `background` | any CSS colour | `"#000000"` | The colour of the bars when `fit` is `contain`. |
| `videoEnd` | `"hold"`, `"loop"` | `"hold"` | What a video does if it ends before the playlist moves on. |
| `debug` | `true`, `false` | `false` | Shows a small box on screen with the ad playing, how many milliseconds it took to appear, and which ad is next. Turn it on to check a screen, then off again. |

---

## Tips

- **Match the ad size to your screen**, for example 1920×1080 for a landscape Full HD screen, so
  nothing gets cropped or letterboxed.
- **Keep ads the same length.** The item has one duration, so a short ad would sit on its last frame
  (or loop) until the time is up.
- **Keep video files small.** Encode as H.264 MP4. Every screen downloads the whole zip.
- **To change ads,** edit your unzipped copy, zip it again and replace the old item in the playlist.

---

## Troubleshooting

| What you see | Why | Fix |
|---|---|---|
| The upload fails with *"index.html not found at the root of the zip file"* | You zipped the folder instead of its contents. | Open the folder, select everything inside, and zip that. |
| *"Add your ads to the "ads" folder, named 01, 02, 03 and so on."* | There's no file numbered `01` with a supported type in `ads/`. | Rename your first ad to `01.jpg` (or `01.png`, `01.mp4`, …). |
| Some ads never play | There's a gap in the numbers, or a file has an unsupported type. | Number them 01, 02, 03 with no gaps, and use a supported type. |
| The upload fails on one of the ads | The file's extension doesn't match its real type (for example a JPEG renamed to `.png`), or it's a type the upload doesn't accept, such as HEIC. | Export it again from your design app in the format its extension says. |
| The same ad plays every time | The screen isn't keeping the counter (its `localStorage` is cleared or blocked). | Check the player's web view settings, or ask your signage provider whether local storage is supported for HTML5 packages. |
| A video shows a black screen | The codec isn't supported by the player. | Re-encode as H.264 MP4. |
| An ad looks cropped or has bars | Its shape doesn't match the screen. | Resize the ad, or change `fit` in `app/settings.js`. |

### Testing in a browser

Browsers block pages opened straight from disk from loading local files, so serve the folder:

```bash
cd ad-rotator
python3 -m http.server 8000
```

Then open:

- `http://localhost:8000/?debug=1` shows which ad is playing, how fast it appeared and which one is next.
- `http://localhost:8000/?reset=1` starts again from ad 1.

Reload the page to step through the rotation.

---

## Limitations

- **Proof of play counts the package as one item.** Reports show that the Ad Rotator played, not which
  ad inside it played.
- **Videos are muted**, because players and browsers block autoplay with sound.
- **One duration for every ad.**
- **No per-screen or per-time targeting.** Every screen rotates through the same ads.
- **Needs a player that supports HTML5 (zip) packages** and keeps `localStorage` between plays.

---

## Learn more

- [Digital Signage Ad Rotation: Play a Different Ad Every Playlist Loop](https://easysignage.com/blog/26/digital-signage-ad-rotation/): planning an ad slot,
  plays-per-hour maths, ad specs and design tips.
- [What Are Custom Digital Signage Apps?](https://easysignage.com/blog/26/custom-digital-signage-apps/):
  how HTML5 packages like this one work.

---

## For developers

```
.
├── package/            the source of the zip (what users see when they unzip)
│   ├── index.html
│   ├── HOW-TO-USE.txt
│   ├── ads/
│   └── app/
│       ├── rotator.js  rotation logic
│       ├── settings.js user settings
│       └── style.css
├── samples/            sample ads added to the demo zip
├── build.sh            builds both zips into dist/
└── dist/               built zips
```

Build:

```bash
bash build.sh
```

Notes:

- Plain ES5 JavaScript with no dependencies and no build step, so it runs on older Android web views.
- A page opened from local files can't list a folder. That's why ads are found by number: the app
  tries `ads/<n>.<ext>` with the number written as `01`, `1` and `001`, for every supported extension,
  in both lower and upper case.
- The counter is stored under a key based on the page's path, so each uploaded package keeps its own
  rotation.
- Only file types that HTML5 package validators commonly accept are used (`html`, `js`, `css`,
  `txt`, images and videos).

Contributions are welcome. Please open an issue or pull request.
