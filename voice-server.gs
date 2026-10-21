/**
 * Kana Flashcards · voice server for Free listen
 *
 * Turns words into speech with Google Cloud Text-to-Speech, so the app can
 * stitch them into one audio track that keeps playing with the screen locked.
 *
 * This is a separate Apps Script project from your sheet script. Setup steps
 * are in FREE-LISTEN-SETUP.md. Your API key goes in Project Settings →
 * Script properties as TTS_API_KEY, never in this file.
 *
 * The app sends:   POST {"action":"tts","rate":0.9,"sampleRate":22050,"items":[{"text":"…","lang":"ja"}, …]}
 * It gets back:    {"ok":true,"clips":[{"audio":"<base64 WAV>"} | {"error":"…"}, …]}
 * Checking a link: GET ?action=ping → {"ok":true,"service":"kana-voice","configured":true}
 */

// Voices used for each side. Browse others at
// https://cloud.google.com/text-to-speech/docs/list-voices-and-types
// If a name stops being offered, the script falls back to Google's default
// voice for that language automatically.
var VOICES = {
  ja: { languageCode: 'ja-JP', name: 'ja-JP-Neural2-B' },
  en: { languageCode: 'en-US', name: 'en-US-Neural2-F' }
};

var MAX_ITEMS = 40;   // words per request
var MAX_TEXT = 200;   // characters per word or phrase

function doGet(e) {
  return json_({
    ok: true,
    service: 'kana-voice',
    configured: !!getKey_(),
    voices: VOICES
  });
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (body.action !== 'tts') return json_({ ok: false, error: 'Unknown action.' });

    var key = getKey_();
    if (!key) {
      return json_({ ok: false, error: 'The voice server has no API key yet. Add TTS_API_KEY under Project Settings → Script properties.' });
    }

    var items = Array.isArray(body.items) ? body.items.slice(0, MAX_ITEMS) : [];
    var rate = clamp_(Number(body.rate) || 1, 0.25, 2);
    var sampleRate = Math.round(clamp_(Number(body.sampleRate) || 22050, 8000, 48000));

    var clips = new Array(items.length);
    var work = [];   // indexes of valid items
    items.forEach(function (it, i) {
      var text = it && typeof it.text === 'string' ? it.text.trim() : '';
      var lang = it && it.lang;
      if (!text || !VOICES[lang]) clips[i] = { error: 'Skipped an empty or unknown item.' };
      else if (text.length > MAX_TEXT) clips[i] = { error: 'Text too long: ' + text.slice(0, 20) + '…' };
      else work.push(i);
    });

    // first try with the chosen voices
    var retry = [];
    if (work.length) {
      var responses = UrlFetchApp.fetchAll(work.map(function (i) {
        return request_(key, items[i], rate, sampleRate, true);
      }));
      responses.forEach(function (res, j) {
        var i = work[j];
        var code = res.getResponseCode();
        if (code === 200) {
          clips[i] = { audio: JSON.parse(res.getContentText()).audioContent };
        } else {
          clips[i] = { error: errorText_(res) };
          if (code === 400 || code === 404) retry.push(i); // likely a voice name that isn't offered
        }
      });
    }

    // then once more with the language's default voice
    if (retry.length) {
      var again = UrlFetchApp.fetchAll(retry.map(function (i) {
        return request_(key, items[i], rate, sampleRate, false);
      }));
      again.forEach(function (res, j) {
        var i = retry[j];
        if (res.getResponseCode() === 200) clips[i] = { audio: JSON.parse(res.getContentText()).audioContent };
        else clips[i] = { error: errorText_(res) };
      });
    }

    // a wrong key or an API that isn't enabled fails every word: report it once, clearly
    var anyAudio = clips.some(function (c) { return c && c.audio; });
    if (work.length && !anyAudio) {
      var first = clips[work[0]];
      return json_({ ok: false, error: 'Google Text-to-Speech refused the request: ' + (first && first.error) });
    }

    return json_({ ok: true, clips: clips });
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  }
}

function request_(key, item, rate, sampleRate, useNamedVoice) {
  var v = VOICES[item.lang];
  var voice = useNamedVoice ? { languageCode: v.languageCode, name: v.name } : { languageCode: v.languageCode };
  return {
    url: 'https://texttospeech.googleapis.com/v1/text:synthesize?key=' + encodeURIComponent(key),
    method: 'post',
    contentType: 'application/json',
    muteHttpExceptions: true,
    payload: JSON.stringify({
      input: { text: item.text.trim() },
      voice: voice,
      // LINEAR16 comes back as a WAV file, which the app stitches without re-encoding
      audioConfig: { audioEncoding: 'LINEAR16', sampleRateHertz: sampleRate, speakingRate: rate }
    })
  };
}

function errorText_(res) {
  try {
    var data = JSON.parse(res.getContentText());
    if (data && data.error && data.error.message) return data.error.message;
  } catch (err) {}
  return 'HTTP ' + res.getResponseCode();
}

function getKey_() {
  return PropertiesService.getScriptProperties().getProperty('TTS_API_KEY') || '';
}

function clamp_(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v));
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Optional: run this once from the editor (select testVoice, press Run) to
 * check your key works. The log shows how many bytes of audio came back.
 */
function testVoice() {
  var out = doPost({ postData: { contents: JSON.stringify({ action: 'tts', items: [{ text: 'こんにちは', lang: 'ja' }, { text: 'hello', lang: 'en' }] }) } });
  var data = JSON.parse(out.getContent());
  if (!data.ok) throw new Error(data.error);
  data.clips.forEach(function (c, i) {
    Logger.log(i + ': ' + (c.audio ? Math.round(c.audio.length * 0.75) + ' bytes of audio' : c.error));
  });
}
