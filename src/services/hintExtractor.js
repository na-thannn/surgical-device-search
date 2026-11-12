import { normalizeText } from "./textProcessing.js";

const BRAND_PATTERNS = [
  { value: "J&J", terms: ["j&j", "johnson", "ethicon", "harmonic"] },
  { value: "Medtronic", terms: ["medtronic", "covidien", "ligasure", "sonicision"] },
  { value: "Olympus", terms: ["olympus", "sonosurg"] },
  { value: "Karl Storz", terms: ["karl storz", "storz"] },
  { value: "Stryker", terms: ["stryker"] },
  { value: "ConMed", terms: ["conmed"] },
  { value: "Intuitive", terms: ["intuitive", "da vinci", "robotic", "robot"] },
  { value: "Babcock", terms: ["babcock"] },
  { value: "Boston Scientific", terms: ["boston", "boston scientific"] },
  { value: "Cook Medical", terms: ["cook", "cook medical"] }
];

const FUNCTION_PATTERNS = [
  { value: "biopsy", terms: ["lay mau mo", "mau mo", "sinh thiet", "biopsy", "lay mau", "giai phau benh", "pathology"] },
  { value: "cut", terms: ["cat", "cut", "scissor", "scissors", "keo"] },
  { value: "coagulate", terms: ["cam mau", "coagulate", "coagulation", "dot", "cautery", "cauterize"] },
  { value: "seal vessel", terms: ["han mach", "seal", "vessel sealing", "ligasure"] },
  { value: "grasp", terms: ["kep", "gap", "grasper", "forceps", "clamp"] },
  { value: "hold tissue", terms: ["giu mo", "giu mo nhe", "cay giu mo", "hold tissue", "retract tissue"] },
  { value: "clip", terms: ["clip", "kep clip", "clip applier", "clipper"] },
  { value: "suction", terms: ["hut", "suction"] },
  { value: "irrigation", terms: ["rua", "irrigation", "irrigator", "irrigate", "bom rua"] },
  { value: "staple", terms: ["stapler", "bam noi", "ghim", "staple"] },
  { value: "suture", terms: ["khau", "suture", "needle holder", "kim khau"] },
  {
    value: "contain specimen",
    terms: [
      "hop dung benh pham",
      "hop benh pham",
      "lo benh pham",
      "hop dung mau",
      "lo dung mau",
      "specimen container",
      "sample container",
      "lo formol",
      "hop formol"
    ]
  },
  { value: "retrieve specimen", terms: ["lay benh pham", "specimen bag", "retrieval bag", "tui lay"] }
];

const CATEGORY_PATTERNS = [
  { value: "ultrasonic", terms: ["sieu am", "ultrasonic", "harmonic"] },
  { value: "vessel sealing", terms: ["han mach", "vessel", "ligasure", "enseal"] },
  { value: "laparoscopic", terms: ["noi soi", "laparoscopic", "laparoscopy", "endo"] },
  { value: "electrosurgery", terms: ["dot dien", "dao dien", "bovie", "monopolar", "bipolar", "hook", "moc dot"] },
  { value: "suction", terms: ["hut", "suction", "irrigation", "rua"] },
  { value: "specimen retrieval", terms: ["benh pham", "specimen", "retrieval bag", "endo bag"] },
  {
    value: "specimen handling",
    terms: [
      "hop dung benh pham",
      "hop benh pham",
      "lo benh pham",
      "hop dung mau",
      "lo dung mau",
      "specimen container",
      "sample container",
      "formol"
    ]
  },
  { value: "endoscopy", terms: ["noi soi tieu hoa", "endoscopy", "gi scope", "scope"] },
  { value: "robotic", terms: ["robot", "robotic", "da vinci"] },
  { value: "atraumatic grasper", terms: ["khong sang chan", "atraumatic", "giu mo nhe", "cay giu mo", "mo nhe"] }
];

const NEGATION_MARKERS = [
  "khong phai",
  "khong dung",
  "khong lay",
  "khong can",
  "not a",
  "not an",
  "not the",
  "not"
];

const CORRECTION_MARKERS = [
  "a thoi",
  "ah thoi",
  "thoi lay",
  "thoi chon",
  "doi lai",
  "lay lai",
  "lay cua",
  "chon cua",
  "actually",
  "instead",
  "change to"
];

const NEGATED_TERM_PATTERNS = [
  {
    value: "specimen retrieval",
    terms: [
      "tui benh pham",
      "tui lay benh pham",
      "tui endo lay benh pham",
      "tui endo",
      "tui dung benh pham",
      "specimen bag",
      "retrieval bag",
      "endo bag"
    ]
  },
  {
    value: "laparoscopic suction",
    terms: [
      "cay hut rua noi soi thuong",
      "cay hut rua noi soi",
      "ong hut rua noi soi",
      "hut rua noi soi thuong",
      "suction irrigation cannula",
      "laparoscopic suction irrigator"
    ]
  },
  { value: "Yankauer", terms: ["dau hut yankauer", "ong hut yankauer", "yankauer suction", "yankauer"] },
  { value: "Babcock", terms: ["babcock", "kep babcock", "babcock grasper"] },
  { value: "clip", terms: ["clip applier", "cay bam clip", "kep clip", "clipper", "clip"] },
  { value: "endoscopic", terms: ["endoscopic", "laparoscopic", "laparoscopy", "endo", "noi soi"] },
  { value: "ultrasonic", terms: ["ultrasonic", "sieu am", "harmonic"] },
  { value: "vessel sealing", terms: ["vessel sealing", "han mach", "ligasure", "enseal"] },
  { value: "J&J", terms: ["j&j", "johnson", "ethicon", "harmonic"] },
  { value: "Medtronic", terms: ["medtronic", "covidien", "ligasure"] },
  { value: "Olympus", terms: ["olympus", "sonosurg"] }
];

function findCorrectionSegment(normalizedInput) {
  const starts = CORRECTION_MARKERS
    .map(marker => normalizedInput.lastIndexOf(normalizeText(marker)))
    .filter(index => index >= 0);

  if (starts.length === 0) {
    return "";
  }

  return normalizedInput.slice(Math.max(...starts));
}

function findCorrectedTerms(normalizedInput) {
  const correctionSegment = findCorrectionSegment(normalizedInput);
  const correctedTerms = [];
  const termsToKeep = [];

  if (!correctionSegment) {
    return { correctedTerms, termsToKeep };
  }

  for (const pattern of NEGATED_TERM_PATTERNS) {
    const terms = pattern.terms
      .map(term => normalizeText(term))
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);

    for (const term of terms) {
      if (correctionSegment.includes(term)) {
        correctedTerms.push(pattern.value);
        termsToKeep.push(...terms);
        break;
      }
    }
  }

  return {
    correctedTerms: [...new Set(correctedTerms)],
    termsToKeep: [...new Set(termsToKeep)]
  };
}

function findMatches(normalizedInput, patterns) {
  const matches = [];

  for (const pattern of patterns) {
    for (const term of pattern.terms) {
      const normalizedTerm = normalizeText(term);
      if (normalizedTerm && normalizedInput.includes(normalizedTerm)) {
        matches.push(pattern.value);
        break;
      }
    }
  }

  return [...new Set(matches)];
}

function findNegatedTerms(normalizedInput) {
  const matches = [];
  const spans = [];
  const termsToRemove = [];
  const { correctedTerms } = findCorrectedTerms(normalizedInput);
  const correctedTermSet = new Set(correctedTerms);

  for (const pattern of NEGATED_TERM_PATTERNS) {
    const terms = pattern.terms
      .map(term => normalizeText(term))
      .filter(Boolean)
      .sort((a, b) => b.length - a.length);

    for (const marker of NEGATION_MARKERS) {
      const normalizedMarker = normalizeText(marker);

      for (const term of terms) {
        const phrase = `${normalizedMarker} ${term}`;
        if (normalizedInput.includes(phrase)) {
          spans.push(phrase);

          if (!correctedTermSet.has(pattern.value)) {
            matches.push(pattern.value);
            termsToRemove.push(...terms);
          }

          break;
        }
      }
    }
  }

  return {
    negatedTerms: [...new Set(matches)],
    correctedTerms,
    spans: [...new Set(spans)],
    termsToRemove: [...new Set(termsToRemove)]
  };
}

function removeNegatedSpans(normalizedInput, spans) {
  let cleaned = ` ${normalizedInput} `;

  for (const span of spans.sort((a, b) => b.length - a.length)) {
    cleaned = cleaned.replaceAll(` ${span} `, " ");
  }

  return cleaned.replace(/\s+/g, " ").trim();
}

function removeStandaloneTerms(normalizedInput, terms) {
  let cleaned = ` ${normalizedInput} `;

  for (const term of terms.sort((a, b) => b.length - a.length)) {
    cleaned = cleaned.replaceAll(` ${term} `, " ");
  }

  return cleaned.replace(/\s+/g, " ").trim();
}

export function extractHints(inputText) {
  const normalized = normalizeText(inputText);
  const { negatedTerms, correctedTerms, spans, termsToRemove } = findNegatedTerms(normalized);
  const positiveQuery = removeStandaloneTerms(removeNegatedSpans(normalized, spans), termsToRemove);

  return {
    normalized_query: normalized,
    embedding_query: positiveQuery || normalized,
    negated_terms: negatedTerms,
    corrected_terms: correctedTerms,
    brands: findMatches(positiveQuery, BRAND_PATTERNS),
    functions: findMatches(positiveQuery, FUNCTION_PATTERNS),
    categories: findMatches(positiveQuery, CATEGORY_PATTERNS)
  };
}
