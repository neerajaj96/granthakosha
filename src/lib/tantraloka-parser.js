/**
 * Tantrāloka Ch.1 parser — verse units from the Dyczkowski translation file.
 * Structure per unit: [Viveka intro prose] [Devanāgarī verse] [IAST, skipped]
 * [English translation … (N)] [footnotes 7 / * …].
 *
 * Two-phase: every line is classified once (deva/iast/note/closer/title/…),
 * then prose runs are routed by how they END — a run ending in a verse-closer
 * is translation (en); any other run is Viveka discussion (current verse) or
 * pending intro (next verse). Appendix prose is grouped without closers.
 * Output: ExportDoc with Passage{mula, en} + Commentary(Viveka|Notes).
 * Text is NEVER normalized — lines joined raw.
 */

const TITLES = [
  'The Types of Liberating Knowledge',
  'The Introductory Verses',
  'The Initial Invocation',
  'In Praise of the Deities',
  'In Praise of the Teachers',
  'The Purpose of the Book',
  'Concerning Freedom and Bondage',
  'Concerning the Knower',
  'Definitions of the Forms',
  'The a priori Nature',
  'Ubiquitous, Eternal and Omniform',
  'The Powers of',
  'The Innate Nature of the Group',
  'Established in Rāma',
  'Degrees of Freedom',
  'The Etymology of the Names',
  'The Exposition of the Tantr',
  'The Deployment of',
  'The Nourishing Power',
  'Limited and Unlimited',
  'Injunctions do not Apply',
  'Obscured and Unobscured',
  'Concerning the Means',
  'Preliminary Analysis',
  'Knowledge Extends into Action',
  'all His powers',
  'Liberation is One, the Means are Many',
  'Definition of the Three Penetrations',
  'Explanation of the Definition',
  'Conception and Nonconceptual',
  'Varieties of Gradations',
  'The Five Elements',
  'Thirty-six Principles',
  'The Divine Attributes',
  'Powers and Attributes as Means',
  'Free of Thought Constructs',
  'The Empowered Means',
  'The Individual Means',
  'Attain the Same Goal',
  'Concluding Summary',
  'The Teacher and His Spiritual Family',
  'The Removal of Impurity',
  'Enunciation, Definition and Investigation',
  'The Supreme and other Relationships',
  'Enunciation of the Topics',
  'Detailed Enunciation',
  'The Concluding verses',
];

const RE_CLOSER = /\(([0-9]+[a-d]?(?:\s*[-/;,]\s*[0-9]+[a-d]?)*)\)\s*$/;
const RE_BROKEN = /\(\d+[a-d]?\s*[-/;,]?\s*$/;
const RE_NOTE = /^(\d+|\*)\s+(?![\d/])(?![A-Z\s\d'’.,;:!?()-]+$)/;
const RE_PAGE_NUM = /^[०-९0-9\s]+$/;
const RE_ROMAN = /^[ivxlcdm]+$/i;
const RE_HEADER_RUN = /^(TANTRĀLOKA|CHAPTER ONE|\d+\s+CHAPTER ONE|TANTRĀLOKA\s+\d+)$/;
const RE_PAGEBREAK = /^(TANTRĀLOKA|CHAPTER ONE|\d+\s+CHAPTER ONE|TANTRĀLOKA\s+\d+|[0-9\s]+)$/;
const RE_APPENDIX_HEAD = /^Appendix [A-ZА-Я]/;
const RE_APPENDIX_NOISE = /APPENDIX [A-Z].*CHAPTER ONE|CHAPTER ONE.*APPENDIX/;
const RE_DIACRITIC = /[āīūṛṝṣñṭḍṇṃḥ]/g;

function countDeva(s) {
  const m = s.match(/[\u0900-\u097F]/g);
  return m ? m.length : 0;
}
function countLatin(s) {
  const m = s.match(/[a-zA-Z]/g);
  return m ? m.length : 0;
}
function isDevaLine(s) {
  const d = countDeva(s);
  return d > 0 && d >= countLatin(s);
}
function isIastLine(s) {
  if (s.includes('|')) return true;
  if (s.length > 110 || countDeva(s) > 0) return false;
  // Bare transliteration: diacritics but no sentence punctuation or brackets.
  // (Scholarly prose quoting Sanskrit always carries punctuation/parens.)
  // Bare transliteration: diacritics but no sentence punctuation or brackets.
  // (Scholarly prose quoting Sanskrit always carries punctuation/parens.)
  if (/[()[\]'".,;:!?—–\-/]/.test(s)) return false;
  const m = s.match(RE_DIACRITIC);
  return m !== null && m.length >= 2;
}
function cleanSection(s) {
  return s.replace(/А/g, 'A').replace(/В/g, 'B').replace(/[\s\d]+$/, '').trim();
}
function isTitle(s) {
  return s.length < 100 && TITLES.some((t) => s.startsWith(t));
}

export function parseTantraloka(rawText, opts = {}) {
  const title = opts.title || 'Tantrāloka, Ch. 1';
  const subtitle = opts.subtitle || 'Abhinavagupta · Viveka of Jayaratha · tr. Dyczkowski (ch. 1)';
  const scriptures = [{ id: opts.scriptureId || 'tantraloka', title, subtitle, language: 'sa-Deva', createdAt: 0, updatedAt: 0 }];
  const passages = [];
  const commentaries = [];
  const stats = { droppedNoise: 0, sections: {}, authors: {}, warnings: [] };
  const note = (k, v) => {
    stats[k] = stats[k] || {};
    stats[k][v] = (stats[k][v] || 0) + 1;
  };

  const lines = String(rawText).split('\n').map((l) => l.replace(/\r$/, ''));
  let start = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim() === 'The Introductory Verses') {
      start = i;
      for (let j = i - 1; j >= Math.max(0, i - 120); j--) {
        if (lines[j].trim().startsWith('The Types of Liberating Knowledge')) { start = j; break; }
      }
      break;
    }
  }

  // Phase 1: classify once.
  const kind = new Array(lines.length).fill('prose');
  for (let i = start; i < lines.length; i++) {
    const s = lines[i].trim();
    if (!s) { kind[i] = 'blank'; continue; }
    if (RE_PAGE_NUM.test(s) || RE_ROMAN.test(s) || RE_HEADER_RUN.test(s) || RE_APPENDIX_NOISE.test(s)) { kind[i] = 'noise'; continue; }
    if (isTitle(s)) { kind[i] = 'title'; continue; }
    if (RE_APPENDIX_HEAD.test(s)) { kind[i] = 'appendix'; continue; }
    if (isIastLine(s)) { kind[i] = 'iast'; continue; }
    if (isDevaLine(s)) { kind[i] = 'deva'; continue; }
    if (RE_NOTE.test(s)) { kind[i] = 'note'; continue; }
    if (RE_CLOSER.test(s)) { kind[i] = 'closer'; continue; }
    if (RE_BROKEN.test(s) && i + 1 < lines.length && RE_CLOSER.test(`${s} ${lines[i + 1].trim()}`)) { kind[i] = 'broken'; continue; }
  }

  // Phase 2: route prose runs by their ending.
  let section = 'The Types of Liberating Knowledge (vijñānabhid)';
  let appendixMode = false;
  let devaBuf = [];
  let pendingLines = [];
  let pendingNotes = [];
  let curTika = [];
  let curNotes = [];
  let inNote = false;
  let currentPid = null;
  let appendixBuf = [];
  let enStage = [];

  function emit(author, text, pid) {
    const target = pid || currentPid;
    if (!target) {
      (author === 'Notes' ? pendingNotes : pendingLines).push(text);
      return;
    }
    commentaries.push({ id: `c:${commentaries.length + 1}`, passageId: target, author, title: '', text, createdAt: 0, updatedAt: 0 });
    note('authors', author);
  }
  function closeTika() {
    if (curTika.length) emit('Viveka (Jayaratha)', curTika.join('\n'));
    curTika = [];
  }
  function closeNotes() {
    if (curNotes.length) emit('Notes', curNotes.join('\n'));
    curNotes = [];
  }
  function flushVerse(enLines) {
    if (!devaBuf.length && !enLines.length) return;
    const idx = passages.length;
    const pid = `p:${idx + 1}`;
    passages.push({
      id: pid, scriptureId: scriptures[0].id, ordinal: idx + 1,
      section, mula: devaBuf.join('\n'), en: enLines.join('\n'), primaryEn: '',
      createdAt: 0, updatedAt: 0,
    });
    note('sections', section || '(none)');
    devaBuf = [];
    currentPid = pid;
    if (pendingLines.length) {
      emit('Viveka (Jayaratha)', pendingLines.join('\n'), pid);
      pendingLines = [];
    }
    if (pendingNotes.length) {
      emit('Notes', pendingNotes.join('\n'), pid);
      pendingNotes = [];
    }
  }
  function flushAppendix() {
    if (!appendixBuf.length) return;
    const idx = passages.length;
    const pid = `p:${idx + 1}`;
    passages.push({
      id: pid, scriptureId: scriptures[0].id, ordinal: idx + 1,
      section, mula: '', en: appendixBuf.join('\n'), primaryEn: '',
      createdAt: 0, updatedAt: 0,
    });
    note('sections', section || '(none)');
    appendixBuf = [];
    currentPid = pid;
  }
  // Route staged prose: to translation (returned) or Viveka/pending (pushed).
  function routeStaged(toTranslation) {
    if (!enStage.length) return [];
    const run = enStage.splice(0);
    if (toTranslation) return run;
    if (appendixMode) {
      appendixBuf.push(...run);
      if (appendixBuf.length >= 10) flushAppendix();
    } else if (currentPid === null) {
      pendingLines.push(...run);
    } else {
      curTika.push(...run);
    }
    return [];
  }

  let i = start;
  while (i < lines.length) {
    const s = lines[i].trim();
    const k = kind[i];
    i++;
    if (k === 'blank' || k === 'noise' || k === 'iast') {
      stats.droppedNoise++;
      if (k === 'noise' && inNote && RE_PAGEBREAK.test(s)) {
        for (let j = i; j < Math.min(i + 6, lines.length); j++) {
          const kj = kind[j];
          if (kj === 'closer' || kj === 'broken') { inNote = false; break; }
          if (kj === 'deva' || kj === 'title' || kj === 'note' || kj === 'appendix') break;
        }
      }
      continue;
    }
    if (k === 'title' || k === 'appendix') {
      routeStaged(false);
      closeTika();
      closeNotes();
      inNote = false;
      if (appendixMode) flushAppendix();
      section = cleanSection(s);
      appendixMode = k === 'appendix';
      continue;
    }
    if (k === 'deva') {
      routeStaged(false);
      closeTika();
      closeNotes();
      inNote = false;
      if (appendixMode) flushAppendix();
      devaBuf.push(s);
      continue;
    }
    if (k === 'note') {
      routeStaged(false);
      closeTika();
      closeNotes();
      inNote = true;
      if (appendixMode) {
        appendixBuf.push(s);
        if (appendixBuf.length >= 10) flushAppendix();
      } else {
        curNotes.push(s);
      }
      continue;
    }
    if (k === 'closer' || k === 'broken') {
      closeTika();
      closeNotes();
      inNote = false;
      enStage.push(s);
      if (k === 'broken' && i < lines.length) { enStage.push(lines[i].trim()); i++; }
      const run = routeStaged(true);
      if (appendixMode) {
        appendixBuf.push(...run);
        if (appendixBuf.length >= 10) flushAppendix();
      } else {
        flushVerse(run);
      }
      continue;
    }
    // prose (or unclassified): staged for translation, or joined to open note
    if (inNote && !appendixMode) curNotes.push(s);
    else enStage.push(s);
  }
  routeStaged(false);
  closeTika();
  closeNotes();
  flushVerse([]);
  if (appendixMode) flushAppendix();
  if ((pendingLines.length || pendingNotes.length) && passages.length) {
    if (pendingLines.length) emit('Viveka (Jayaratha)', pendingLines.join('\n'), passages[0].id);
    if (pendingNotes.length) emit('Notes', pendingNotes.join('\n'), passages[0].id);
    pendingLines = [];
    pendingNotes = [];
  }
  if (pendingLines.length || pendingNotes.length) stats.warnings.push('preface lines unattached');
  return { version: 1, exportedAt: Date.now(), scriptures, passages, commentaries, stats };
}
