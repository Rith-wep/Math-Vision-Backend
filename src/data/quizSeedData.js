export const quizSeedData = [
  {
    subjectId: "general",
    titleKh: "គណិតវិទ្យាទូទៅ",
    summaryKh: "ហាត់សំណួរគណិតមូលដ្ឋាន ដូចជា បូក ដក គុណ ចែក និងសមីការងាយៗ",
    accent: "from-emerald-500 to-green-500",
    image_url: "",
    levels: [
      {
        levelNumber: 1,
        label: "Level 1",
        requiredScore: 80,
        image_url: "",
        questions: [
          {
            questionId: 1,
            promptKh: "តើលទ្ធផលនៃប្រមាណវិធីខាងក្រោមស្មើអ្វី?",
            latex: "8 + 7",
            explanationKh: "បូក 8 និង 7 ជាមួយគ្នា នោះយើងទទួលបាន 15។",
            image_url: "",
            options: [
              { id: "a", label: "15", isCorrect: true },
              { id: "b", label: "14", isCorrect: false },
              { id: "c", label: "16", isCorrect: false },
              { id: "d", label: "13", isCorrect: false }
            ]
          },
          {
            questionId: 2,
            promptKh: "តើចម្លើយត្រឹមត្រូវសម្រាប់សមីការងាយនេះមួយណា?",
            latex: "x + 5 = 12",
            explanationKh: "ដក 5 ចេញពីសងខាង នោះយើងបាន x = 7។",
            image_url: "",
            options: [
              { id: "a", label: "x = 5", isCorrect: false },
              { id: "b", label: "x = 6", isCorrect: false },
              { id: "c", label: "x = 7", isCorrect: true },
              { id: "d", label: "x = 8", isCorrect: false }
            ]
          }
        ]
      },
      { levelNumber: 2, label: "Level 2", requiredScore: 80, image_url: "", questions: [] },
      { levelNumber: 3, label: "Level 3", requiredScore: 80, image_url: "", questions: [] },
      { levelNumber: 4, label: "Level 4", requiredScore: 80, image_url: "", questions: [] },
      { levelNumber: 5, label: "Level 5", requiredScore: 80, image_url: "", questions: [] }
    ]
  },
  {
    subjectId: "derivatives",
    titleKh: "ដេរីវេ",
    summaryKh: "ហាត់ច្បាប់ដេរីវេ និងសំណួរអនុវត្តជាបន្តបន្ទាប់",
    accent: "from-green-600 to-emerald-600",
    image_url: "",
    levels: [
      {
        levelNumber: 1,
        label: "Level 1",
        requiredScore: 80,
        image_url: "",
        questions: [
          {
            questionId: 1,
            promptKh: "តើដេរីវេរបស់អនុគមន៍នេះស្មើអ្វី?",
            latex: "y = x^2 + 5x + 1",
            explanationKh: "ដេរីវេរបស់ x^2 គឺ 2x, ដេរីវេរបស់ 5x គឺ 5 ហើយថេរ 1 មានតម្លៃ 0។",
            image_url: "",
            options: [
              { id: "a", label: "2x + 5", isCorrect: true },
              { id: "b", label: "x + 5", isCorrect: false },
              { id: "c", label: "2x + 1", isCorrect: false },
              { id: "d", label: "x^2 + 5", isCorrect: false }
            ]
          },
          {
            questionId: 2,
            promptKh: "តើដេរីវេរបស់ sin x ជាអ្វី?",
            latex: "\\frac{d}{dx}(\\sin x)",
            explanationKh: "តាមច្បាប់ដេរីវេត្រីកោណមាត្រ ដេរីវេរបស់ sin x គឺ cos x។",
            image_url: "",
            options: [
              { id: "a", label: "\\cos x", isCorrect: true },
              { id: "b", label: "-\\cos x", isCorrect: false },
              { id: "c", label: "\\sin x", isCorrect: false },
              { id: "d", label: "-\\sin x", isCorrect: false }
            ]
          }
        ]
      },
      { levelNumber: 2, label: "Level 2", requiredScore: 80, image_url: "", questions: [] },
      { levelNumber: 3, label: "Level 3", requiredScore: 80, image_url: "", questions: [] },
      { levelNumber: 4, label: "Level 4", requiredScore: 80, image_url: "", questions: [] },
      { levelNumber: 5, label: "Level 5", requiredScore: 80, image_url: "", questions: [] }
    ]
  },
  {
    subjectId: "integrals",
    titleKh: "អាំងតេក្រាល",
    summaryKh: "បង្កើនជំនាញអាំងតេក្រាលមិនកំណត់ និងការអនុវត្ត",
    accent: "from-lime-500 to-green-600",
    image_url: "",
    levels: [
      {
        levelNumber: 1,
        label: "Level 1",
        requiredScore: 80,
        image_url: "",
        questions: [
          {
            questionId: 1,
            promptKh: "តើអាំងតេក្រាលនេះស្មើអ្វី?",
            latex: "\\int 2x\\,dx",
            explanationKh: "ប្រើច្បាប់អាំងតេក្រាលអំណាច នោះយើងបាន x^2 + C។",
            image_url: "",
            options: [
              { id: "a", label: "x^2 + C", isCorrect: true },
              { id: "b", label: "2x + C", isCorrect: false },
              { id: "c", label: "x^3 + C", isCorrect: false },
              { id: "d", label: "\\ln x + C", isCorrect: false }
            ]
          },
          {
            questionId: 2,
            promptKh: "តើអាំងតេក្រាលរបស់ cos x ស្មើអ្វី?",
            latex: "\\int \\cos x\\,dx",
            explanationKh: "អាំងតេក្រាលរបស់ cos x គឺ sin x ហើយបន្ថែមថេរ C។",
            image_url: "",
            options: [
              { id: "a", label: "\\sin x + C", isCorrect: true },
              { id: "b", label: "-\\sin x + C", isCorrect: false },
              { id: "c", label: "\\cos x + C", isCorrect: false },
              { id: "d", label: "\\tan x + C", isCorrect: false }
            ]
          }
        ]
      },
      { levelNumber: 2, label: "Level 2", requiredScore: 80, image_url: "", questions: [] },
      { levelNumber: 3, label: "Level 3", requiredScore: 80, image_url: "", questions: [] },
      { levelNumber: 4, label: "Level 4", requiredScore: 80, image_url: "", questions: [] },
      { levelNumber: 5, label: "Level 5", requiredScore: 80, image_url: "", questions: [] }
    ]
  }
];
