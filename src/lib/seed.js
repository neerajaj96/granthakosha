/** Seed corpus extracted verbatim from the Google Doc (Durgasaptashati, Guptavati-adi-sapta-tika-samvalita).
 * Batch 1 content: working English renderings (en), one combined primary
 * explanation per verse (primaryEn, layman Indian English, synthesizing the
 * verse + ALL its commentaries), and layman renderings of each tika (simpleEn).
 */

export const SEED_TITLE = "Durgāsaptaśatī · Seed Verses";
export const SEED_SUBTITLE = "Six-verse starter selection (the complete text loads separately)";

export const SEED_PASSAGES = [
  {
    section: "Upoddhātaḥ",
    mula: "श्रीगणेशाय नमः",
    en: "Salutation to Lord Gaṇeśa.",
    primaryEn: "Every holy book in our tradition begins by bowing to Lord Gaṇeśa, the remover of obstacles. This small line is the mangala — the auspicious start. The Guptavatī commentary opens in the same spirit, remembering Lord Rāma and the chain of teachers, because no sacred study begins without first saluting God and the guru who hands the knowledge down.",
    commentaries: [
      {
        author: "Guptavatī (Bhāskararāya)",
        title: "Maṅgalācaraṇa",
        text: "श्रीरामं प्रतिपुष्कराभिधमहायक्षेण वेदत्रयव्याख्यानावसरे विशिष्य कथितं श्रीविष्णुधर्मोत्तरे ।",
        simpleEn: "The commentary begins with a prayer to Lord Rāma and to the line of masters, following the path shown in the scriptures. Its message in simple words: bow to God and guru first, then open the book.",
      },
    ],
  },
  {
    section: "Upoddhātaḥ",
    mula: "वृषवाहनविघ्नेशौ हंसवाहां सरस्वतीम् ।\nस्वेष्टं श्रीबटुकं नत्वा पितरं व्यङ्कटं ततः ॥१॥",
    en: "Having bowed to Gaṇeśa who rides the bull, to Sarasvatī who rides the swan, to one's own chosen deity Śrī Baṭuka, and then to (my) father Vyaṅkaṭa. (1)",
    primaryEn: "In this opening verse the author bows to four powers before starting his work: Lord Gaṇeśa (Vighneśa, Yao removes obstacles), Goddess Sarasvatī (who gives knowledge and words), his own chosen deity Baṭuka (a form of Bhairava), and his father Vyaṅkaṭa. The Guptavatī explains the deeper idea behind such praise: even the great gods Brahmā, Viṣṇu and Śiva can create, protect and dissolve the world only by the power of the Divine Mother — without Her grace, even the greatest are helpless for a moment. Harikṛṣṇa adds the simple rule: every religious book must begin by saluting one's own favourite deities, and that is exactly what the author is doing here.",
    commentaries: [
      {
        author: "Guptavatī (Bhāskararāya)",
        title: "Śloka 1",
        text: "विधिविष्णुमुखामरोदयस्थितिनाशेषु शिवोऽप्यनीश्वरः । जगदम्ब तव त्वयं क्रमः क्षणमुद्दालकपुष्पभञ्जिका ॥",
        simpleEn: "Brahmā, Viṣṇu and the other gods rise and set like flowers that bloom and fall in a moment. Even Lord Śiva cannot manage the work of creation and destruction without You, O Mother of the world. Everything depends on Your power alone.",
      },
      {
        author: "Harikṛṣṇa (Durgopāsana-saṅgraha)",
        title: "Śloka 1 — vṛṣavāhana",
        text: "वृषवाहनविघ्नेशौ हंसवाहां सरस्वतीम् — स्वेष्टदेवतानमस्कारपूर्वकं ग्रन्थारम्भः ।",
        simpleEn: "This verse lists the author's own beloved gods — Gaṇeśa, Sarasvatī and the rest. Rule of our books: first bow to your chosen deities, then begin the work. That is all this verse is doing.",
      },
    ],
  },
  {
    section: "Upoddhātaḥ",
    mula: "श्रीगौतमकुलोत्पन्नो ज्योतिर्विद्व्यङ्कटात्मजः ।\nहरिकृष्णः करोत्यत्र दुर्गोपासनसङ्ग्रहम् ॥२॥",
    en: "Born in the family of Gautama, son of the astrologer Vyaṅkaṭa — Harikṛṣṇa here composes a collection (saṅgraha) on the worship of Durgā. (2)",
    primaryEn: "Here the author introduces himself in the traditional style: his name is Harikṛṣṇa, he is born in the Gautama family line, and his father Vyaṅkaṭa was a learned astrologer. He tells us plainly what this book is — a saṅgraha, a collected handbook of Durgā worship. The Guptavatī notes that from this point the book lays out its full plan: first the auspicious opening, then a summary of all the topics, and then the deep explanation of the word Caṇḍī and the meaning of the Goddess — so the reader always knows where the journey is going.",
    commentaries: [
      {
        author: "Guptavatī (Bhāskararāya)",
        title: "Grantha-pratipādya",
        text: "मङ्गलाचरणं ग्रन्थप्रतिपाद्यार्थसङ्ग्रहः । ततश्चण्डीतिशब्दस्य तदर्थस्य च निर्णयः ॥",
        simpleEn: "The book follows a clear plan. First the opening prayer, then a short list of all topics it will cover, and then the deep meaning of the word Caṇḍī and who the Goddess truly is. Nothing is random — everything comes in order.",
      },
    ],
  },
  {
    section: "Upoddhātaḥ",
    mula: "अस्यामुपासनायां वै साधारणमपेक्षितम् ।\nतत्सर्वं पूर्वमेवोक्तं विज्ञेयमिह चादरात् ॥३॥",
    en: "Whatever general matters are needed for this worship have all been explained earlier itself; the sincere seeker should learn them here with full respect. (3)",
    primaryEn: "The author gives honest advice to the reader: the day-to-day basics of worship — how to sit, how to chant, how to offer — have already been taught in his earlier works, so he will not repeat everything here. A sincere student should first learn those general rules carefully and with respect, and then enter the special worship of Durgā taught in this book. There is no commentary on this verse — its meaning is direct: master the basics first, then come to the Mother's special worship.",
    commentaries: [],
  },
  {
    section: "Upoddhātaḥ",
    mula: "चण्डीनाम परब्रह्मणः पट्टमहिषी देवता ।",
    en: "The deity named Caṇḍī is the royal consort (crowned queen) of the Supreme Brahman.",
    primaryEn: "This one line carries the whole philosophy of the book: Caṇḍī is not a small or angry goddess — She is the crowned queen of the Supreme Brahman itself, His very own power. The Guptavatī explains Her name with love and logic: Caṇḍī comes from a root word meaning a burning anger that frightens away evil, and the scriptures say even the wind blows and the sun rises out of holy fear of that supreme power. So Her fierceness is not cruelty — it is the protective anger of a mother that destroys ignorance and shelters Her children. Nāgojibhaṭṭa adds the grammar rule behind Her name: from the word Caṇḍa, by the feminine ending, comes Caṇḍī — the Empress Herself.",
    commentaries: [
      {
        author: "Guptavatī (Bhāskararāya)",
        title: "Caṇḍī-śabda-nirṇaya",
        text: "चडि कोप इति धातोर्निष्पत्तिः — भीषास्माद्वातः पवते भीषोदेति सूर्यः इत्यादिश्रुत्या वाय्वादिभयजनककोपस्यापि परब्रह्मलिङ्गत्वम् ।",
        simpleEn: "The name Caṇḍī comes from a word meaning burning anger. But this is holy anger — the scriptures say the wind blows and the sun rises only out of fear of the Supreme. So even Her anger proves She is the highest power, and that anger protects good people and burns away ignorance.",
      },
      {
        author: "Nāgojibhaṭṭa (prācīna-ṭīkā)",
        title: "Caṇḍī-pada",
        text: "तस्माच्छब्दात् पुंयोगलक्षणे ङीषि चण्डीति पदनिष्पत्तिः ।",
        simpleEn: "By Sanskrit grammar, the word Caṇḍī is formed from Caṇḍa with a feminine ending. Small rule, big meaning: the name itself declares Her the Supreme Queen.",
      },
    ],
  },
  {
    section: "Navārṇa-mantroddhāraḥ",
    mula: "वाङ्माया ब्रह्मसूस्तस्मात् षष्ठं वक्त्रसमन्वितम् ।",
    en: "Vāk (the seed of speech), Māyā (the seed of power), Brahmasū (the seed of desire) — and from that (seed), the sixth letter joined with the mouth (the vowel ā)… [the nine-lettered mantra is thus built up].",
    primaryEn: "This verse begins revealing the famous nine-lettered (navārṇa) mantra of the Goddess — the same mantra millions chant as 'Aiṃ Hrīṃ Klīṃ Cāmuṇḍāyai Vicce'. Step by step it names the three seed-sounds hidden inside it: Aiṃ, the seed of holy speech and knowledge (Goddess Sarasvatī); Hrīṃ, the seed of divine power (Goddess Lakṣmī); and Klīṃ, the seed of attraction and bliss (Goddess Kālī). The Devyatharvaśīrṣa Upaniṣad, quoted here, confirms the same three seeds — speech, power and desire — which together wake up the three forms of the Mother in the chanter's heart: wisdom, abundance and fearless joy.",
    commentaries: [
      {
        author: "Devyatharvaśīrṣa",
        title: "Navārṇa",
        text: "वाक् वाग्भवबीजम् (ऐं) । माया शक्तिः हल्लेखैव (ह्रीं) । ब्रह्मसूः कामः (क्लीं) ।",
        simpleEn: "The Upaniṣad itself opens the secret: Vāk means the seed Aiṃ (holy speech), Māyā means the seed Hrīṃ (divine power), and Brahmasū means the seed Klīṃ (divine desire). These three small sounds carry Sarasvatī, Lakṣmī and Kālī inside them.",
      },
    ],
  },
];

/** Vedic/IAST stress sample for unicode-integrity tests. */
export const UNICODE_PROBE =
  "ऋ॑षिः ॒गाय॑त्री अ॒ग्निमी॑ळे ॥ ॐ ऐं ह्रीं क्लीं चामुण्डायै विच्चे ॥ śrī durgāyai namaḥ ॥१॥";
