/** Seed corpus extracted verbatim from the Google Doc (Durgasaptashati, Guptavati-adi-sapta-tika-samvalita). */

export const SEED_TITLE = "Durgāsaptaśatī";
export const SEED_SUBTITLE = "Guptavatyādi-sapta-ṭīkā-saṃvalitā (seed from Google Doc)";

/** First mula verses of the Upoddhāta + genuine commentary excerpts. Text kept EXACT. */
export const SEED_PASSAGES = [
  {
    section: "Upoddhātaḥ",
    mula: "श्रीगणेशाय नमः",
    commentaries: [
      {
        author: "Guptavatī (Bhāskararāya)",
        title: "Maṅgalācaraṇa",
        text: "श्रीरामं प्रतिपुष्कराभिधमहायक्षेण वेदत्रयव्याख्यानावसरे विशिष्य कथितं श्रीविष्णुधर्मोत्तरे ।",
      },
    ],
  },
  {
    section: "Upoddhātaḥ",
    mula: "वृषवाहनविघ्नेशौ हंसवाहां सरस्वतीम् ।\nस्वेष्टं श्रीबटुकं नत्वा पितरं व्यङ्कटं ततः ॥१॥",
    commentaries: [
      {
        author: "Guptavatī (Bhāskararāya)",
        title: "Śloka 1",
        text: "विधिविष्णुमुखामरोदयस्थितिनाशेषु शिवोऽप्यनीश्वरः । जगदम्ब तव त्वयं क्रमः क्षणमुद्दालकपुष्पभञ्जिका ॥",
      },
      {
        author: "Harikṛṣṇa (Durgopāsana-saṅgraha)",
        title: "Śloka 1 — vṛṣavāhana",
        text: "वृषवाहनविघ्नेशौ हंसवाहां सरस्वतीम् — स्वेष्टदेवतानमस्कारपूर्वकं ग्रन्थारम्भः ।",
      },
    ],
  },
  {
    section: "Upoddhātaḥ",
    mula: "श्रीगौतमकुलोत्पन्नो ज्योतिर्विद्व्यङ्कटात्मजः ।\nहरिकृष्णः करोत्यत्र दुर्गोपासनसङ्ग्रहम् ॥२॥",
    commentaries: [
      {
        author: "Guptavatī (Bhāskararāya)",
        title: "Grantha-pratipādya",
        text: "मङ्गलाचरणं ग्रन्थप्रतिपाद्यार्थसङ्ग्रहः । ततश्चण्डीतिशब्दस्य तदर्थस्य च निर्णयः ॥",
      },
    ],
  },
  {
    section: "Upoddhātaḥ",
    mula: "अस्यामुपासनायां वै साधारणमपेक्षितम् ।\nतत्सर्वं पूर्वमेवोक्तं विज्ञेयमिह चादरात् ॥३॥",
    commentaries: [],
  },
  {
    section: "Upoddhātaḥ",
    mula: "चण्डीनाम परब्रह्मणः पट्टमहिषी देवता ।",
    commentaries: [
      {
        author: "Guptavatī (Bhāskararāya)",
        title: "Caṇḍī-śabda-nirṇaya",
        text: "चडि कोप इति धातोर्निष्पत्तिः — भीषास्माद्वातः पवते भीषोदेति सूर्यः इत्यादिश्रुत्या वाय्वादिभयजनककोपस्यापि परब्रह्मलिङ्गत्वम् ।",
      },
      {
        author: "Nāgojibhaṭṭa (prācīna-ṭīkā)",
        title: "Caṇḍī-pada",
        text: "तस्माच्छब्दात् पुंयोगलक्षणे ङीषि चण्डीति पदनिष्पत्तिः ।",
      },
    ],
  },
  {
    section: "Navārṇa-mantroddhāraḥ",
    mula: "वाङ्माया ब्रह्मसूस्तस्मात् षष्ठं वक्त्रसमन्वितम् ।",
    commentaries: [
      {
        author: "Devyatharvaśīrṣa",
        title: "Navārṇa",
        text: "वाक् वाग्भवबीजम् (ऐं) । माया शक्तिः हल्लेखैव (ह्रीं) । ब्रह्मसूः कामः (क्लीं) ।",
      },
    ],
  },
];

/** Vedic/IAST stress sample for unicode-integrity tests. */
export const UNICODE_PROBE =
  "ऋ॑षिः ॒गाय॑त्री अ॒ग्निमी॑ळे ॥ ॐ ऐं ह्रीं क्लीं चामुण्डायै विच्चे ॥ śrī durgāyai namaḥ ॥१॥";
