# Free listen

Free listen plays the current word bank as audio, with nothing to tap. Each card goes like this:

1. One side is spoken. The "show first" switch picks which side.
2. A pause gives you time to answer in your head ("thinking time").
3. The other side is spoken.
4. A short pause ("after answer"), then a ding, then the next card.

Cards come in the same order as shuffle. Unmarked cards always come first: while the word bank still has any, only those play. Once every card has a color, the % button sets how often red, yellow and green come up (60 / 30 / 10 to start with). The same card never plays twice in a row.

Open it with the headphones button. On a PC it sits in the left column, or press `l`. On a phone it's next to the word bank name. Closing the panel keeps it playing, and a small player appears at the bottom.

## Settings

| Setting | What it does | Range |
|---|---|---|
| thinking time | Pause before the answer | 1 to 15 s |
| after answer | Pause after the answer, before the ding | 0.5 to 6 s |
| speech speed | 1 is normal speed | 0.6 to 1.3× |
| ding | Ding between cards | on / off |
| voice | **built-in**: the device's own voices. **lock-screen**: audio from the voice server (below) | |
| track length | Lock-screen only: how long the track runs before it loops | 10 / 15 / 30 min |

Changes are saved on each device. To change what a new device starts with, edit `FREE_LISTEN_DEFAULTS` near the top of the script in `index.html`.

## Which voice to use

| | PC, window minimized | iPhone, screen on | iPhone, screen locked |
|---|---|---|---|
| built-in | ✅ | ✅ (the screen stays awake while playing) | ❌ iOS stops browser speech on lock |
| lock-screen | ✅ | ✅ | ✅ with play/pause on the lock screen |

The built-in voice needs no setup. On Windows it uses the voices installed on the PC. Microsoft Edge has good online "Natural" voices, and if no Japanese voice is listed, add Japanese under Settings → Time & language → Language & region. You can pick a specific voice under "Built-in voices" in the panel.

Lock-screen audio needs the voice server, a small script in your Google account. The app downloads each word's audio once, saves it on the device, and builds one continuous track with the pauses and dings already in it. iOS treats that track like a podcast, so it keeps playing with the phone locked.

## Setting up the voice server (about 15 minutes, once)

The voice server uses Google Cloud Text-to-Speech. Google requires a billing account to turn the API on. The monthly free allowance is 1 million characters for the Neural2 voices this script uses. A word bank of 100 words is roughly 1,000 to 2,000 characters, and each word is only downloaded once per device, so normal use stays far inside the free allowance.

### 1. Turn on Text-to-Speech in Google Cloud

1. Go to <https://console.cloud.google.com/> and sign in with your Google account.
2. Create a project: click the project picker at the top → **New project**, name it something like `kana-voice` → **Create**. Make sure it's selected.
3. Link billing: **Billing** in the menu, then link or create a billing account for this project.
4. Recommended: **Billing → Budgets & alerts → Create budget**, set the amount to $1, and keep the email alerts on. You'll hear about it long before anything costs real money.
5. Enable the API: search the top bar for **Cloud Text-to-Speech API** → **Enable**.

### 2. Create an API key

1. **APIs & Services → Credentials → Create credentials → API key**.
2. Click the new key, then under **API restrictions** choose **Restrict key** and tick only **Cloud Text-to-Speech API**. **Save**.
3. Copy the key.

### 3. Create the voice server script

1. Go to <https://script.google.com/> → **New project**. Name it `Kana voice server`. This is a new project, separate from your sheet's script.
2. Delete what's in `Code.gs` and paste in all of `voice-server.gs`. Save.
3. Click the gear (**Project Settings**) → **Script properties** → **Add script property**.
   Property: `TTS_API_KEY`. Value: the key from step 2. **Save**.
4. Optional check: back in the editor, pick `testVoice` from the function menu and press **Run**. Allow the permissions it asks for. The log should show two lines with "bytes of audio".

### 4. Deploy it

1. **Deploy → New deployment**. Click the gear next to "Select type" → **Web app**.
2. Execute as: **Me**. Who has access: **Anyone**.
3. **Deploy**, authorize if asked, and copy the **Web app URL** (it ends in `/exec`).

### 5. Connect the app

In Free listen, open **Lock-screen audio**, paste the link, and press **Connect**. Do this on each device. To skip that step, paste the link into `DEFAULT_VOICE_URL` near the top of the script in `index.html`. Keep in mind that a public GitHub repo makes the link visible, and anyone with it could use your free allowance.

The first play of a word bank downloads its words, and you'll see "Preparing audio · 12 / 40 words". After that, it starts right away and works offline for words already downloaded.

## Good to know

- **Changing settings while playing.** The built-in voice picks changes up from the next card. Lock-screen audio rebuilds the track in a second or two and continues from the current card. A speed change downloads the words again at the new speed.
- **The track loops.** A 15-minute track holds roughly 80 to 100 cards, picked with the weights at the moment you press play. Press pause, then play, to get a fresh order that uses your latest marks.
- **Lock-screen controls.** Play/pause, next and previous card work from the lock screen, Control Center and headphones.
- **Changing the voices.** Edit `VOICES` in `voice-server.gs`, then **Deploy → Manage deployments → edit (pencil) → Version: New version → Deploy**. The link stays the same. In the app, tap **clear saved audio** so the words are downloaded again in the new voice.
- **Updating the script later.** Always use **Manage deployments → New version**. A brand new deployment gets a new link.
