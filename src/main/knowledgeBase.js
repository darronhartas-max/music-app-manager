// src/main/knowledgeBase.js
// Centralized metadata dictionaries for manufacturers, keywords, plugin detection, and categorization.

const BUNDLE_MANUFACTURERS = {
    'com.ableton': 'Ableton',
    'com.apple.garageband': 'Apple',
    'com.apple.logic': 'Apple',
    'com.apple.mainstage': 'Apple',
    'com.avid': 'Avid',
    'com.steinberg': 'Steinberg',
    'com.image-line': 'Image-Line',
    'com.presonus': 'PreSonus',
    'com.cockos': 'Cockos',
    'com.bitwig': 'Bitwig',
    'com.reasonstudios': 'Reason Studios',
    'com.propellerhead': 'Reason Studios',
    'com.native-instruments': 'Native Instruments',
    'de.native-instruments': 'Native Instruments',
    'com.arturia': 'Arturia',
    'com.xferrecords': 'Xfer Records',
    'com.spectrasonics': 'Spectrasonics',
    'com.vitalaudio': 'Vital Audio',
    'com.matt-tytel': 'Vital Audio',
    'com.ikmultimedia': 'IK Multimedia',
    'com.positivegrid': 'Positive Grid',
    'com.neuraldsp': 'Neural DSP',
    'com.izotope': 'iZotope',
    'com.fabfilter': 'FabFilter',
    'com.waves': 'Waves',
    'com.soundtoys': 'Soundtoys',
    'com.valhalladsp': 'Valhalla DSP',
    'com.celemony': 'Celemony',
    'com.antarestech': 'Antares',
    'com.output': 'Output',
    'com.cherryaudio': 'Cherry Audio',
    'com.cherry-audio': 'Cherry Audio',
    'com.softube': 'Softube',
    'com.plugin-alliance': 'Plugin Alliance',
    'com.pluginalliance': 'Plugin Alliance',
    'com.uhe': 'u-he',
    'de.uhe': 'u-he',
    'com.kilohearts': 'Kilohearts',
    'com.noiseengineering': 'Noise Engineering',
    'com.audiodamage': 'Audio Damage',
    'com.sugar-bytes': 'Sugar Bytes',
    'com.sugarbytes': 'Sugar Bytes',
    'com.zynaptiq': 'Zynaptiq',
    'com.soundradix': 'SoundRadix',
    'com.eventide': 'Eventide',
    'com.goodhertz': 'Goodhertz',
    'com.slate-digital': 'Slate Digital',
    'com.slatedigital': 'Slate Digital',
    'com.exponentialaudio': 'Exponential Audio',
    'com.2caudio': '2CAudio',
    'com.liquidsonics': 'Liquid Sonics',
    'com.audioease': 'Audio Ease',
    'com.airwindows': 'Airwindows',
    'com.klanghelm': 'Klanghelm',
    'uk.co.acustica': 'Acustica Audio',
    'com.acusticaaudio': 'Acustica Audio',
    'com.meldaproduction': 'Melda Production',
    'com.apulsoft': 'Apulsoft',
    'com.brainworx': 'Brainworx',
    'com.overloud': 'Overloud',
    'com.leapwing': 'Leapwing Audio',
    'com.newfangled': 'Newfangled Audio',
    'com.roland': 'Roland',
    'com.korg': 'Korg',
    'com.yamaha': 'Yamaha',
    'com.moogmusic': 'Moog',
    'com.spitfireaudio': 'Spitfire Audio',
    'com.eastwestsounds': 'EastWest',
    'com.heavyocity': 'Heavyocity',
    'com.8dio': '8Dio',
    'com.orchestraltools': 'Orchestral Tools',
    'com.algoriddim': 'Algoriddim',
    'com.pioneerdj': 'Pioneer DJ',
    'com.serato': 'Serato',
    'com.makemusic': 'MakeMusic',
    'com.uaudio': 'Universal Audio',
    'com.universalaudio': 'Universal Audio',
    'com.splice': 'Splice',
    'com.reaper': 'Cockos',
    'com.pulsaraudio': 'Pulsar Audio',
    'com.oeksound': 'oeksound',
    'com.tokyodawn': 'Tokyo Dawn Records',
    'com.sonnox': 'Sonnox',
    'com.voxengo': 'Voxengo',
    'com.cableguys': 'Cableguys',
    'com.audiomodern': 'Audiomodern',
    'com.gforce': 'GForce Software',
    'com.focusrite': 'Focusrite',
    'org.surge-synth-team': 'Surge Synth Team',
    'org.audacityteam': 'Audacity',
    'com.fatar': 'Studiologic',
    'com.paceap': 'iLok / PACE',
    'com.muse': 'Muse',
    'se.propellerheads': 'Reason Studios',
    'audio.vital': 'Vital Audio',
    'jp.co.korg': 'Korg'
};

const KNOWN_PUBLISHERS = {
    'Arturia': /arturia|analog lab|pigments|v collection|mcl|augmented|vocoder v|stage-73|b-3 v|farfisa|piano v|synthi v|mini v|modular v|prophet|oberheim|matrix-12|dx7|cz v|sq80|emulator|buchla|jup-8|cs-80|mellotron|solina|ms-20|jun-6|op-xa|cmi v|clavi v|wurlitzer|vox continental|sem v/i,
    'Native Instruments': /native instruments|ni |kontakt|massive|reaktor|komplete|maschine|traktor|guitar rig|battery|fm8|absynth/i,
    'Waves': /waves|waves central/i,
    'FabFilter': /fabfilter|pro-q|pro-c|pro-r|pro-l|saturn|timeless|volcano|twin|simplon/i,
    'iZotope': /izotope|ozone|neutron|rx |nectar|neoverb|vocal doubling|trash/i,
    'Soundtoys': /soundtoys|decapitator|echoboy|crystallizer|panman|microshift|primaltap|sie-q|radiator|devil-loc|little alterboy/i,
    'Valhalla DSP': /valhalla|vintageverb|room|shimmer|delay|supermassive|spacemodulator|uberMod|freqecho/i,
    'Softube': /softube|tape|satn knob|model 72|model 84|harmonics|tube-tech/i,
    'Slate Digital': /slate digital|fg-x|verbcms|fresh air|virtual mix|vca|meta/i,
    'Neural DSP': /neural dsp|archetype|tone king|cory wong|gojira|abasi|nolly|soldano|plini|nameless/i,
    'IK Multimedia': /ik multimedia|amplitube|sampletank|t-rack|tonex|modo/i,
    'Plugin Alliance': /plugin alliance|brainworx|spl |unfiltered audio|bx_|shadow hills|maag/i,
    'u-he': /u-he|diva|zebra|hive|repro|bazille|presswerk|satin|twangstr/i,
    'Spectrasonics': /spectrasonics|omnisphere|keyscape|trilian|stylus rmx/i,
    'Universal Audio': /universal audio|uaudio|uad|ucloud|spark|luna/i,
    'Output': /output|arcade|exhale|portal|thermal|movement|substance|rev /i,
    'Cherry Audio': /cherry audio|voltage|ca2600|polymode|mercury|gx-80|dreamsynth|elka|dco-106|surrealistic|eight voice|miniverse|sines|harmonia/i,
    'Kilohearts': /kilohearts|khs |phase plant|multipass|snap heap/i,
    'Eventide': /eventide|blackhole|h910|h949|instant flanger|physion|sp2016/i,
    'Celemony': /celemony|melodyne/i,
    'Antares': /antares|auto-tune|autotune|auto-key/i,
    'MeldaProduction': /meldaproduction|mcompressor|mequalizer|mautopitch/i,
    'Ableton': /ableton/i,
    'Apple': /logic|garageband|mainstage/i,
    'Steinberg': /steinberg|cubase|nuendo|wavelab|dorico|halion|groove agent/i,
    'Avid': /avid|pro tools|sibelius/i,
    'PreSonus': /presonus|studio one/i,
    'Image-Line': /image-line|fl studio|fruity/i,
    'Bitwig': /bitwig/i,
    'Reason Studios': /reason studios|propellerhead|reason/i,
    'Cockos': /cockos|reaper/i,
    'Applied Acoustics Systems': /applied acoustics systems|aas |chromaphone|lounge lizard|strum|ultra analog/i,
    'LennarDigital': /lennardigital|sylenth/i,
    'Xfer Records': /xfer|serum|ott|nerve|cthulhu|lfo tool/i,
    'Reveal Sound': /reveal sound|spire/i,
    'Vital Audio': /vital audio|vital/i,
    'Spitfire Audio': /spitfire|labs|bbc symphony|albion/i,
    'oeksound': /oeksound|soothe|spiff|bloom/i,
    'Pulsar Audio': /pulsar audio|pulsar 1178|pulsar echorec|pulsar mu/i,
    'Cableguys': /cableguys|shaperbox|halftime|curve/i,
    'Tokyo Dawn Records': /tokyo dawn|tdr /i,
    'Sonnox': /sonnox|oxford/i,
    'Voxengo': /voxengo|span|gliss|curveeq/i,
    'Caelum Audio': /caelum audio/i,
    'Baby Audio': /baby audio|smooth operator|spacelab|transit|atoms|cask/i
};

const UPDATE_MANAGERS = [
    'native access', 'arturia software center', 'waves central', 'ilok license manager',
    'ua connect', 'splice', 'pulse downloader', 'steinberg download assistant',
    'avid link', 'toontrack product manager', 'spitfire audio app', 'ik product manager',
    'installation manager', 'plugin alliance installation manager'
];

const KNOWN_KEYWORDS = [
    'ableton', 'logic pro', 'pro tools', 'cubase', 'nuendo', 'fl studio', 'studio one', 'reaper', 'bitwig', 'reason',
    'garageband', 'mainstage', 'dorico', 'finale', 'sibelius', 'serum', 'massive', 'vital', 'omnisphere', 'pigments',
    'analog lab', 'v collection', 'komplete kontrol', 'kontakt', 'maschine', 'traktor', 'rekordbox', 'serato',
    'amplitube', 'bias fx', 'neural dsp', 'archetype', 'guitar rig', 'melodyne', 'autotune', 'izotope', 'ozone',
    'neutron', 'nectar', 'waves central', 'arturia software center', 'native access', 'avid link', 'splice',
    'volca', 'korg', 'moog', 'roland cloud', 'vcv rack', 'cherry audio', 'voltage modular', 'synth', 'tone king',
    'piano v', 'synthi v', 'jup-8', 'cs-80', 'mellotron', 'solina', 'mini v', 'modular v', 'prophet', 'ms-20', 'jun-6', 'op-xa', 'cmi v', 'clavi v', 'wurlitzer', 'vox continental', 'sem v',
    'luna', 'bitwig studio', 'renoise', 'mixcraft', 'acoustica'
];

const GENERIC_TERMS = [
    'audio', 'music', 'sound', 'studio', 'sequencer', 'daw', 'synth', 'synthesizer', 'instrument', 'plugin',
    'vst', 'vst3', 'vst2', 'au ', 'component', 'sampler', 'drum machine', 'groovebox', 'dj ', 'turntable',
    'mixing', 'mastering', 'record', 'oscillator', 'filter', 'keyboard', 'piano', 'guitar', 'bass', 'drums',
    'orchestra', 'tuner', 'metronome', 'score', 'notation', 'midi'
];

const INSTRUMENT_KEYWORDS = [
    'synth', 'piano', 'drum', 'bass', 'guitar', 'organ', 'strings', 'brass', 'sampler', 'kontakt', 'oscillator',
    'vco', 'analog', 'fm', 'wavetable', 'spectral', 'granular', 'kick', 'snare', 'percussion', 'mallet', 'orchestral',
    'choir', 'keys', 'rhodes', 'wurli', 'clavi', 'hammond', 'poly', 'mono', 'omnisphere', 'serum', 'vital',
    'massive', 'pigments', 'diva', 'zebra', 'hive', 'repro', 'sylenth', 'arcade', 'falcon', 'halion', 'sampletank',
    'spire', 'nexus', 'avenger', 'model 72', 'model 84', 'arp 2600', 'buchla', 'cs-80', 'dx7', 'emulator',
    'fairlight', 'jup-8', 'matrix-12', 'mellotron', 'mini v', 'modular v', 'oberheim', 'prophet', 'solina',
    'synclavier', 'synthi', 'vocoder v', 'vox continental', 'augmented', 'stage-73', 'b-3 v', 'farfisa',
    'battery', 'absynth', 'fm8', 'soundfont', 'soundfont player', 'sound canvas'
];

const EFFECT_KEYWORDS = [
    'reverb', 'delay', 'eq', 'equalizer', 'compressor', 'limiter', 'satn', 'saturation', 'distortion', 'drive',
    'fuzz', 'amp', 'cab', 'speaker', 'chorus', 'flanger', 'phaser', 'tremolo', 'vibrato', 'filter', 'gate',
    'expander', 'de-esser', 'transient', 'shaper', 'pitch', 'shift', 'harmony', 'autotune', 'melodyne',
    'vocoder', 'convolution', 'plate', 'room', 'hall', 'spring', 'tape', 'tube', 'console', 'channel strip',
    'meter', 'visualizer', 'scope', 'analyzer', 'clipper', 'stereo', 'width', 'image', 'utility', 'ozone',
    'neutron', 'nectar', 'pro-q', 'pro-c', 'pro-l', 'pro-r', 'saturn', 'valhalla', 'shaperbox', 'half-time',
    'portal', 'thermal', 'blackhole', 'vintageverb', 'delay vvv', 'soothe', 'spiff', 'fresh air', 'decapitator',
    'echoboy', 'little alterboy', 'infinifilter', 'smooth operator'
];

function isKnownMusicBundleId(bundleId) {
    if (!bundleId) return false;
    const lower = bundleId.toLowerCase();
    return Object.keys(BUNDLE_MANUFACTURERS).some(domain => lower.startsWith(domain));
}

function manufacturerFromBundleId(bundleId, allowGenericFallback = false) {
    if (!bundleId) return null;
    const lower = bundleId.toLowerCase();
    for (const [domain, name] of Object.entries(BUNDLE_MANUFACTURERS)) {
        if (lower.startsWith(domain)) return name;
    }
    if (allowGenericFallback) {
        const parts = lower.split('.');
        if (parts.length >= 2) {
            const seg = parts[1];
            const skip = new Set(['apple', 'google', 'microsoft', 'adobe', 'electron', 'app', 'com', 'net', 'org', 'io', 'co', 'uk']);
            if (!skip.has(seg)) {
                return seg
                    .replace(/-/g, ' ')
                    .split(' ')
                    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
                    .join(' ');
            }
        }
    }
    return null;
}

function detectManufacturer(nameOrPath, bundleId = '', allowGenericFallback = false) {
    if (bundleId) {
        const fromId = manufacturerFromBundleId(bundleId, false);
        if (fromId) return fromId;
    }
    for (const [name, regex] of Object.entries(KNOWN_PUBLISHERS)) {
        if (regex.test(nameOrPath) || (bundleId && regex.test(bundleId))) {
            return name;
        }
    }
    if (bundleId && allowGenericFallback) {
        const fallback = manufacturerFromBundleId(bundleId, true);
        if (fallback) return fallback;
    }
    return 'Unknown';
}

function suggestCategory(fileName, bundleId = '', manufacturer = '') {
    const haystack = (fileName + ' ' + (bundleId || '')).toLowerCase();

    // DAWs
    if (/ableton|logic pro|pro tools|cubase|nuendo|fl studio|studio one|reaper|bitwig|reason|garageband|mainstage|dorico|finale|sibelius|ardour|luna|renoise/.test(haystack)) {
        return 'DAWs';
    }

    // License / Utilities
    if (UPDATE_MANAGERS.some(m => haystack.includes(m)) || /traktor|rekordbox|serato|virtual dj|djay|waves central|native access|avid link|splice|software center|software pass|cherry audio sync|reason companion|midi control center|download|install|manager|product manager|access|control 2/i.test(haystack)) {
        return 'Utilities';
    }

    // Guitar & Bass
    if (/guitar|amplitube|bias|neural|helix|kemper|amp sim|archetype|rig |tone king|cory wong|gojira|abasi|nolly|tonex|ampeg/i.test(haystack)) {
        return 'Guitar & Bass';
    }

    // Audio Tools / Effects (check before Synths so Surge XT Effects and Audacity land in Audio Tools)
    if (/audacity|surge xt effects|uvr|ultimate vocal remover/i.test(haystack)) {
        return 'Audio Tools';
    }

    // Synths & Virtual Instruments
    if (INSTRUMENT_KEYWORDS.some(k => haystack.includes(k))) {
        return 'Synths';
    }

    // Audio Tools / Effects
    if (EFFECT_KEYWORDS.some(k => haystack.includes(k)) || /fabfilter|soundtoys|valhalla|izotope|slate|brainworx|softube|eventide|mercury recorder|ozone|imager|maximizer|denoiser/i.test(haystack)) {
        return 'Audio Tools';
    }

    // Manufacturer Fallback
    const mfr = (manufacturer || '').toLowerCase();
    if (['arturia', 'spectrasonics', 'u-he', 'vital audio', 'xfer records', 'cherry audio', 'moog', 'korg', 'roland', 'spitfire audio', 'gforce software', 'studiologic', 'surge synth team'].includes(mfr)) {
        return 'Synths';
    }
    if (['fabfilter', 'soundtoys', 'valhalla dsp', 'izotope', 'slate digital', 'oeksound', 'pulsar audio', 'baby audio'].includes(mfr)) {
        return 'Audio Tools';
    }

    return 'Utilities';
}

function detectPluginType(haystack) {
    const lower = (haystack || '').toLowerCase();
    const isInstr = INSTRUMENT_KEYWORDS.some(k => lower.includes(k));
    const isEffect = EFFECT_KEYWORDS.some(k => lower.includes(k));

    if (isInstr && !isEffect) return 'instrument';
    if (isEffect && !isInstr) return 'effect';
    if (isInstr && isEffect) {
        // Tiebreak: synth vs reverb/delay/eq
        if (/reverb|delay|eq|compressor|limiter|gate|chorus|flanger|filter|saturator|pitch/i.test(lower)) return 'effect';
        return 'instrument';
    }
    return 'unknown';
}

module.exports = {
    BUNDLE_MANUFACTURERS,
    KNOWN_PUBLISHERS,
    UPDATE_MANAGERS,
    KNOWN_KEYWORDS,
    GENERIC_TERMS,
    INSTRUMENT_KEYWORDS,
    EFFECT_KEYWORDS,
    isKnownMusicBundleId,
    manufacturerFromBundleId,
    detectManufacturer,
    suggestCategory,
    detectPluginType
};
