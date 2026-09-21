// Names follow the frozen roster audit; card roles and skills are game design assignments.
export const REGIONS={
  "CN": {
    "id": "CN",
    "name": "中国",
    "tagline": "均衡配合",
    "pool": [
      "CN01",
      "CN02",
      "CN03",
      "CN04",
      "CN05",
      "CN06",
      "CN07",
      "CN08",
      "CN09",
      "CN10",
      "CN11",
      "CN12",
      "CN13",
      "CN14",
      "CN15",
      "CN16",
      "CN17",
      "CN18"
    ],
    "start": [
      "CN03",
      "CN07",
      "CN11",
      "CN14",
      "CN16",
      "CN03",
      "CN07",
      "CN03",
      "CN07",
      "CN14"
    ]
  },
  "AM": {
    "id": "AM",
    "name": "美洲",
    "tagline": "多段进攻与易伤",
    "pool": [
      "AM01",
      "AM02",
      "AM03",
      "AM04",
      "AM05",
      "AM06",
      "AM07",
      "AM08",
      "AM09",
      "AM10",
      "AM11",
      "AM12",
      "AM13",
      "AM14",
      "AM15",
      "AM16",
      "AM17",
      "AM18"
    ],
    "start": [
      "AM04",
      "AM07",
      "AM11",
      "AM14",
      "AM16",
      "AM04",
      "AM07",
      "AM04",
      "AM07",
      "AM14"
    ]
  },
  "EMEA": {
    "id": "EMEA",
    "name": "EMEA",
    "tagline": "压制与防守协同",
    "pool": [
      "EU01",
      "EU02",
      "EU03",
      "EU04",
      "EU05",
      "EU06",
      "EU07",
      "EU08",
      "EU09",
      "EU10",
      "EU11",
      "EU12",
      "EU13",
      "EU14",
      "EU15",
      "EU16",
      "EU17",
      "EU18"
    ],
    "start": [
      "EU03",
      "EU07",
      "EU11",
      "EU14",
      "EU16",
      "EU03",
      "EU07",
      "EU03",
      "EU07",
      "EU14"
    ]
  },
  "PAC": {
    "id": "PAC",
    "name": "太平洋",
    "tagline": "临时行动与循环",
    "pool": [
      "PA01",
      "PA02",
      "PA03",
      "PA04",
      "PA05",
      "PA06",
      "PA07",
      "PA08",
      "PA09",
      "PA10",
      "PA11",
      "PA12",
      "PA13",
      "PA14",
      "PA15",
      "PA16",
      "PA17",
      "PA18"
    ],
    "start": [
      "PA02",
      "PA07",
      "PA11",
      "PA14",
      "PA16",
      "PA02",
      "PA07",
      "PA02",
      "PA07",
      "PA14"
    ]
  }
};
export const REGIONAL_ROWS=[
  [
    "AM01",
    "Asuna",
    "决斗",
    0,
    [
      {
        "type": "hit",
        "n": 3,
        "times": 1
      }
    ],
    [
      {
        "type": "hit",
        "n": 5,
        "times": 1
      }
    ],
    "discard"
  ],
  [
    "AM02",
    "OXY",
    "决斗",
    1,
    [
      {
        "type": "hit",
        "n": 4,
        "times": 2
      }
    ],
    [
      {
        "type": "hit",
        "n": 5,
        "times": 2
      }
    ],
    "discard"
  ],
  [
    "AM03",
    "aspas",
    "决斗",
    1,
    [
      {
        "type": "hit",
        "n": 7,
        "times": 1
      }
    ],
    [
      {
        "type": "hit",
        "n": 10,
        "times": 1
      }
    ],
    "discard"
  ],
  [
    "AM04",
    "zekken",
    "决斗",
    1,
    [
      {
        "type": "hit",
        "n": 3,
        "times": 2
      },
      {
        "type": "vulnerable",
        "n": 1
      }
    ],
    [
      {
        "type": "hit",
        "n": 4,
        "times": 2
      },
      {
        "type": "vulnerable",
        "n": 1
      }
    ],
    "discard"
  ],
  [
    "AM05",
    "heat",
    "决斗",
    2,
    [
      {
        "type": "hit",
        "n": 5,
        "times": 3
      }
    ],
    [
      {
        "type": "hit",
        "n": 6,
        "times": 3
      }
    ],
    "discard"
  ],
  [
    "AM06",
    "koalanoob",
    "决斗",
    3,
    [
      {
        "type": "hit",
        "n": 24,
        "times": 1
      }
    ],
    [
      {
        "type": "hit",
        "n": 30,
        "times": 1
      }
    ],
    "discard"
  ],
  [
    "AM07",
    "Cryocells",
    "哨位",
    1,
    [
      {
        "type": "block",
        "n": 5
      },
      {
        "type": "vulnerable",
        "n": 1
      }
    ],
    [
      {
        "type": "block",
        "n": 8
      },
      {
        "type": "vulnerable",
        "n": 1
      }
    ],
    "discard"
  ],
  [
    "AM08",
    "tex",
    "哨位",
    1,
    [
      {
        "type": "block",
        "n": 4
      },
      {
        "type": "token",
        "id": "TK02"
      }
    ],
    [
      {
        "type": "block",
        "n": 7
      },
      {
        "type": "token",
        "id": "TK02"
      }
    ],
    "discard"
  ],
  [
    "AM09",
    "BABYBAY",
    "哨位",
    2,
    [
      {
        "type": "block",
        "n": 14
      }
    ],
    [
      {
        "type": "block",
        "n": 18
      }
    ],
    "discard"
  ],
  [
    "AM10",
    "bang",
    "控场",
    0,
    [
      {
        "type": "weak",
        "n": 1
      }
    ],
    [
      {
        "type": "weak",
        "n": 2
      }
    ],
    "exhaust"
  ],
  [
    "AM11",
    "v1c",
    "控场",
    1,
    [
      {
        "type": "block",
        "n": 3
      },
      {
        "type": "weak",
        "n": 1
      }
    ],
    [
      {
        "type": "block",
        "n": 5
      },
      {
        "type": "weak",
        "n": 1
      }
    ],
    "discard"
  ],
  [
    "AM12",
    "kiNgg",
    "控场",
    1,
    [
      {
        "type": "weak",
        "n": 1
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    [
      {
        "type": "weak",
        "n": 2
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "discard"
  ],
  [
    "AM13",
    "vora",
    "先锋",
    0,
    [
      {
        "type": "draw",
        "n": 1
      }
    ],
    [
      {
        "type": "draw",
        "n": 2
      }
    ],
    "exhaust"
  ],
  [
    "AM14",
    "DaviH",
    "先锋",
    1,
    [
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "hit",
        "n": 3,
        "times": 1
      }
    ],
    [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "hit",
        "n": 3,
        "times": 1
      }
    ],
    "discard"
  ],
  [
    "AM15",
    "mwzera",
    "先锋",
    1,
    [
      {
        "type": "vulnerable",
        "n": 2
      }
    ],
    [
      {
        "type": "vulnerable",
        "n": 3
      }
    ],
    "exhaust"
  ],
  [
    "AM16",
    "Less",
    "自由人",
    1,
    [
      {
        "type": "power",
        "key": "duel",
        "n": 2
      },
      {
        "type": "hit",
        "n": 3,
        "times": 1
      }
    ],
    [
      {
        "type": "power",
        "key": "duel",
        "n": 3
      },
      {
        "type": "hit",
        "n": 3,
        "times": 1
      }
    ],
    "power"
  ],
  [
    "AM17",
    "Zellsis",
    "自由人",
    2,
    [
      {
        "type": "power",
        "key": "init",
        "n": 5
      }
    ],
    [
      {
        "type": "power",
        "key": "init",
        "n": 7
      }
    ],
    "power"
  ],
  [
    "AM18",
    "leaf",
    "自由人",
    3,
    [
      {
        "type": "power",
        "key": "energy",
        "n": 1
      }
    ],
    [
      {
        "type": "power",
        "key": "energy",
        "n": 1
      },
      {
        "type": "power",
        "key": "extraDraw",
        "n": 1
      }
    ],
    "power"
  ],
  [
    "EU01",
    "Derke",
    "决斗",
    0,
    [
      {
        "type": "hit",
        "n": 3,
        "times": 1
      }
    ],
    [
      {
        "type": "hit",
        "n": 5,
        "times": 1
      }
    ],
    "discard"
  ],
  [
    "EU02",
    "kaajak",
    "决斗",
    1,
    [
      {
        "type": "hit",
        "n": 5,
        "times": 1
      },
      {
        "type": "weak",
        "n": 1
      }
    ],
    [
      {
        "type": "hit",
        "n": 8,
        "times": 1
      },
      {
        "type": "weak",
        "n": 1
      }
    ],
    "discard"
  ],
  [
    "EU03",
    "Wo0t",
    "决斗",
    1,
    [
      {
        "type": "hit",
        "n": 7,
        "times": 1
      }
    ],
    [
      {
        "type": "hit",
        "n": 10,
        "times": 1
      }
    ],
    "discard"
  ],
  [
    "EU04",
    "marteen",
    "决斗",
    1,
    [
      {
        "type": "hit",
        "n": 4,
        "times": 2
      }
    ],
    [
      {
        "type": "hit",
        "n": 5,
        "times": 2
      }
    ],
    "discard"
  ],
  [
    "EU05",
    "LewN",
    "决斗",
    2,
    [
      {
        "type": "hit",
        "n": 10,
        "times": 1
      },
      {
        "type": "weak",
        "n": 2
      }
    ],
    [
      {
        "type": "hit",
        "n": 14,
        "times": 1
      },
      {
        "type": "weak",
        "n": 2
      }
    ],
    "discard"
  ],
  [
    "EU06",
    "Lar0k",
    "决斗",
    3,
    [
      {
        "type": "hit",
        "n": 24,
        "times": 1
      }
    ],
    [
      {
        "type": "hit",
        "n": 30,
        "times": 1
      }
    ],
    "discard"
  ],
  [
    "EU07",
    "Alfajer",
    "哨位",
    1,
    [
      {
        "type": "block",
        "n": 4
      },
      {
        "type": "weak",
        "n": 1
      }
    ],
    [
      {
        "type": "block",
        "n": 7
      },
      {
        "type": "weak",
        "n": 1
      }
    ],
    "discard"
  ],
  [
    "EU08",
    "benjyfishy",
    "哨位",
    1,
    [
      {
        "type": "block",
        "n": 4
      },
      {
        "type": "token",
        "id": "TK02"
      }
    ],
    [
      {
        "type": "block",
        "n": 7
      },
      {
        "type": "token",
        "id": "TK02"
      }
    ],
    "discard"
  ],
  [
    "EU09",
    "Crewen",
    "哨位",
    2,
    [
      {
        "type": "block",
        "n": 14
      }
    ],
    [
      {
        "type": "block",
        "n": 18
      }
    ],
    "discard"
  ],
  [
    "EU10",
    "Boaster",
    "控场",
    0,
    [
      {
        "type": "weak",
        "n": 1
      }
    ],
    [
      {
        "type": "weak",
        "n": 2
      }
    ],
    "exhaust"
  ],
  [
    "EU11",
    "Ruxic",
    "控场",
    1,
    [
      {
        "type": "block",
        "n": 5
      },
      {
        "type": "weak",
        "n": 1
      }
    ],
    [
      {
        "type": "block",
        "n": 7
      },
      {
        "type": "weak",
        "n": 1
      }
    ],
    "discard"
  ],
  [
    "EU12",
    "Boo",
    "控场",
    1,
    [
      {
        "type": "weak",
        "n": 1
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    [
      {
        "type": "weak",
        "n": 2
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "discard"
  ],
  [
    "EU13",
    "crashies",
    "先锋",
    0,
    [
      {
        "type": "draw",
        "n": 1
      }
    ],
    [
      {
        "type": "draw",
        "n": 2
      }
    ],
    "exhaust"
  ],
  [
    "EU14",
    "RieNs",
    "先锋",
    1,
    [
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "block",
        "n": 3
      }
    ],
    [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "block",
        "n": 3
      }
    ],
    "discard"
  ],
  [
    "EU15",
    "trexx",
    "先锋",
    1,
    [
      {
        "type": "vulnerable",
        "n": 2
      }
    ],
    [
      {
        "type": "vulnerable",
        "n": 3
      }
    ],
    "exhaust"
  ],
  [
    "EU16",
    "Chronicle",
    "自由人",
    1,
    [
      {
        "type": "power",
        "key": "duel",
        "n": 3
      }
    ],
    [
      {
        "type": "power",
        "key": "duel",
        "n": 4
      }
    ],
    "power"
  ],
  [
    "EU17",
    "nAts",
    "自由人",
    2,
    [
      {
        "type": "power",
        "key": "init",
        "n": 4
      },
      {
        "type": "block",
        "n": 5
      }
    ],
    [
      {
        "type": "power",
        "key": "init",
        "n": 6
      },
      {
        "type": "block",
        "n": 5
      }
    ],
    "power"
  ],
  [
    "EU18",
    "SUYGETSU",
    "自由人",
    3,
    [
      {
        "type": "power",
        "key": "energy",
        "n": 1
      }
    ],
    [
      {
        "type": "power",
        "key": "energy",
        "n": 1
      },
      {
        "type": "power",
        "key": "extraDraw",
        "n": 1
      }
    ],
    "power"
  ],
  [
    "PA01",
    "Meiy",
    "决斗",
    0,
    [
      {
        "type": "hit",
        "n": 3,
        "times": 1
      }
    ],
    [
      {
        "type": "hit",
        "n": 5,
        "times": 1
      }
    ],
    "discard"
  ],
  [
    "PA02",
    "HYUNMIN",
    "决斗",
    1,
    [
      {
        "type": "hit",
        "n": 4,
        "times": 1
      },
      {
        "type": "token",
        "id": "TK01"
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    [
      {
        "type": "hit",
        "n": 7,
        "times": 1
      },
      {
        "type": "token",
        "id": "TK01"
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "discard"
  ],
  [
    "PA03",
    "Jemkin",
    "决斗",
    1,
    [
      {
        "type": "hit",
        "n": 7,
        "times": 1
      }
    ],
    [
      {
        "type": "hit",
        "n": 10,
        "times": 1
      }
    ],
    "discard"
  ],
  [
    "PA04",
    "Dambi",
    "决斗",
    1,
    [
      {
        "type": "hit",
        "n": 5,
        "times": 1
      },
      {
        "type": "token",
        "id": "TK02"
      }
    ],
    [
      {
        "type": "hit",
        "n": 8,
        "times": 1
      },
      {
        "type": "token",
        "id": "TK02"
      }
    ],
    "discard"
  ],
  [
    "PA05",
    "JitBoyS",
    "决斗",
    2,
    [
      {
        "type": "hit",
        "n": 12,
        "times": 1,
        "ifWeak": 4
      }
    ],
    [
      {
        "type": "hit",
        "n": 16,
        "times": 1,
        "ifWeak": 4
      }
    ],
    "discard"
  ],
  [
    "PA06",
    "Zeus",
    "决斗",
    3,
    [
      {
        "type": "hit",
        "n": 24,
        "times": 1
      }
    ],
    [
      {
        "type": "hit",
        "n": 30,
        "times": 1
      }
    ],
    "discard"
  ],
  [
    "PA07",
    "t3xture",
    "哨位",
    1,
    [
      {
        "type": "block",
        "n": 4
      },
      {
        "type": "token",
        "id": "TK02"
      }
    ],
    [
      {
        "type": "block",
        "n": 7
      },
      {
        "type": "token",
        "id": "TK02"
      }
    ],
    "discard"
  ],
  [
    "PA08",
    "xffero",
    "哨位",
    1,
    [
      {
        "type": "block",
        "n": 3
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    [
      {
        "type": "block",
        "n": 6
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "discard"
  ],
  [
    "PA09",
    "Raxcal",
    "哨位",
    2,
    [
      {
        "type": "block",
        "n": 14
      }
    ],
    [
      {
        "type": "block",
        "n": 18
      }
    ],
    "discard"
  ],
  [
    "PA10",
    "MaKo",
    "控场",
    0,
    [
      {
        "type": "weak",
        "n": 1
      }
    ],
    [
      {
        "type": "weak",
        "n": 2
      }
    ],
    "exhaust"
  ],
  [
    "PA11",
    "Karon",
    "控场",
    1,
    [
      {
        "type": "block",
        "n": 3
      },
      {
        "type": "weak",
        "n": 1
      }
    ],
    [
      {
        "type": "block",
        "n": 5
      },
      {
        "type": "weak",
        "n": 1
      }
    ],
    "discard"
  ],
  [
    "PA12",
    "f0rsakeN",
    "控场",
    1,
    [
      {
        "type": "weak",
        "n": 1
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    [
      {
        "type": "weak",
        "n": 2
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "discard"
  ],
  [
    "PA13",
    "invy",
    "先锋",
    0,
    [
      {
        "type": "draw",
        "n": 1
      }
    ],
    [
      {
        "type": "draw",
        "n": 2
      }
    ],
    "exhaust"
  ],
  [
    "PA14",
    "BeYN",
    "先锋",
    1,
    [
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "token",
        "id": "TK01"
      }
    ],
    [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "token",
        "id": "TK01"
      }
    ],
    "discard"
  ],
  [
    "PA15",
    "Munchkin",
    "先锋",
    1,
    [
      {
        "type": "vulnerable",
        "n": 2
      }
    ],
    [
      {
        "type": "vulnerable",
        "n": 3
      }
    ],
    "exhaust"
  ],
  [
    "PA16",
    "Jinggg",
    "自由人",
    1,
    [
      {
        "type": "power",
        "key": "duel",
        "n": 3
      }
    ],
    [
      {
        "type": "power",
        "key": "duel",
        "n": 4
      }
    ],
    "power"
  ],
  [
    "PA17",
    "something",
    "自由人",
    2,
    [
      {
        "type": "power",
        "key": "init",
        "n": 3
      },
      {
        "type": "power",
        "key": "extraDraw",
        "n": 1
      }
    ],
    [
      {
        "type": "power",
        "key": "init",
        "n": 5
      },
      {
        "type": "power",
        "key": "extraDraw",
        "n": 1
      }
    ],
    "power"
  ],
  [
    "PA18",
    "d4v41",
    "自由人",
    3,
    [
      {
        "type": "power",
        "key": "energy",
        "n": 1
      }
    ],
    [
      {
        "type": "power",
        "key": "energy",
        "n": 1
      },
      {
        "type": "power",
        "key": "extraDraw",
        "n": 1
      }
    ],
    "power"
  ]
];
export const REGIONAL_TACTICS={
  "AM01": {
    "title": "抢线点射",
    "scene": "准星先到拐角，第一枪抢到身位。",
    "origin": "枪法 · 抢线",
    "verbs": {
      "hit": "抢线开枪"
    },
    "note": "通用枪法场景；不额外获得首杀奖励。"
  },
  "AM02": {
    "title": "双点试探",
    "scene": "连续两次快速拉枪，争取交火主动。",
    "note": "原创团队战术。所有收益按卡面规则逐项结算，不增加额外命中、击杀、地图位置或隐藏触发条件。",
    "origin": "团队 · 原创战术"
  },
  "AM03": {
    "title": "首枪破点",
    "scene": "准星停在头线，迎着枪声打开缺口。",
    "origin": "枪法 · 突破",
    "verbs": {
      "hit": "抢下首轮交火"
    },
    "note": "首枪是战术名称；任何回合都能打出，不要求本回合第一张。"
  },
  "AM04": {
    "title": "交叉突击",
    "scene": "两次交火逼出位置，为后续接枪打开窗口。",
    "note": "原创团队战术。所有收益按卡面规则逐项结算，不增加额外命中、击杀、地图位置或隐藏触发条件。",
    "origin": "团队 · 原创战术"
  },
  "AM05": {
    "title": "连续转火",
    "scene": "沿着连续暴露的枪线，三次转火追击。",
    "note": "原创团队战术。所有收益按卡面规则逐项结算，不增加额外命中、击杀、地图位置或隐藏触发条件。",
    "origin": "团队 · 原创战术"
  },
  "AM06": {
    "title": "关键回合突破",
    "scene": "关键回合，集中火力冲开对手的第一道防线。",
    "origin": "比赛 · 集中突破",
    "note": "原创枪法场景；不引用选手现实名场面，也不要求回合数或比分条件。"
  },
  "AM07": {
    "title": "交叉架点",
    "scene": "守住入口的同时，给补枪队友留出角度。",
    "note": "原创团队战术。所有收益按卡面规则逐项结算，不增加额外命中、击杀、地图位置或隐藏触发条件。",
    "origin": "团队 · 原创战术"
  },
  "AM08": {
    "title": "冰域拖延",
    "scene": "贤者的减速球铺开，第二颗先留在手中。",
    "origin": "贤者 · 减速球",
    "verbs": {
      "block": "减速拖住进攻",
      "token": "留出第二次封路"
    },
    "note": "减速在这里折算为布防，不另扣对手行动次数；第二颗球要打出生成的临时牌才生效。",
    "source": "https://playvalorant.com/en-us/agents/sage/"
  },
  "AM09": {
    "title": "冰墙封口",
    "scene": "贤者升起冰墙，让入口的火力先撞上墙。",
    "origin": "贤者 · 冰墙",
    "verbs": {
      "block": "冰墙承接火力"
    },
    "note": "墙体不作为独立单位；仅增加布防，按统一时机清空。",
    "source": "https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-11-08/"
  },
  "AM10": {
    "title": "腐坏逼退",
    "scene": "暮蝶抛出腐坏球，逼得对手暂缓前压。",
    "origin": "暮蝶 · 腐坏球",
    "verbs": {
      "weak": "腐坏逼退，形成压制"
    },
    "note": "Meddle 原作造成暂时腐坏；本牌取逼退与犹豫的场景，抽象为压制。不会扣当前或最大防线，也没有持续掉血。",
    "source": "https://playvalorant.com/en-us/agents/clove/"
  },
  "AM11": {
    "title": "毒幕分割",
    "scene": "蝰蛇拉起毒幕，切开入口两侧的枪线。",
    "origin": "蝰蛇 · 毒幕",
    "verbs": {
      "block": "毒幕掩护队友",
      "weak": "分割枪线，形成压制"
    },
    "note": "取 Toxic Screen 分割视野与阻滞进攻的场景；不新增中毒、腐坏、持续伤害或跨比赛隐患。",
    "source": "https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-1-02/"
  },
  "AM12": {
    "title": "暗魇抢位",
    "scene": "幽影的暗魇穿过掩体，队友趁势调整站位。",
    "origin": "幽影 · 暗魇",
    "verbs": {
      "weak": "近视干扰，形成压制",
      "draw": "借机调整战术"
    },
    "note": "Paranoia 限制视野；抽牌表示队伍获得后续选择，不表示技能侦察或揭示敌人。",
    "source": "https://playvalorant.com/en-us/agents/omen/"
  },
  "AM13": {
    "title": "侦察探点",
    "scene": "猎枭的侦察箭落位，为下一步提供情报。",
    "origin": "猎枭 · 侦察箭",
    "verbs": {
      "draw": "侦察获得情报"
    },
    "note": "情报转为抽牌；不改变已公开的意图，也不查看抽牌顺序。",
    "source": "https://playvalorant.com/en-us/agents/sova/"
  },
  "AM14": {
    "title": "侦察接枪",
    "scene": "情报到位，先锋跟上一轮试探射击。",
    "note": "原创团队战术。所有收益按卡面规则逐项结算，不增加额外命中、击杀、地图位置或隐藏触发条件。",
    "origin": "团队 · 原创战术"
  },
  "AM15": {
    "title": "穿墙闪击",
    "scene": "铁臂的闪光穿墙炸开，接枪窗口就在眼前。",
    "origin": "铁臂 · 穿墙闪光",
    "verbs": {
      "vulnerable": "闪光创造接枪窗口"
    },
    "note": "Flashpoint 原作致盲；本牌把接枪窗口抽象为易伤，不代表原作闪光自带增伤。不会跳过对手行动。",
    "source": "https://playvalorant.com/en-us/agents/breach/"
  },
  "AM16": {
    "title": "火力领队",
    "scene": "先开枪牵制，再持续协调突破手的枪线。",
    "note": "原创团队战术。所有收益按卡面规则逐项结算，不增加额外命中、击杀、地图位置或隐藏触发条件。",
    "origin": "团队 · 原创战术"
  },
  "AM17": {
    "title": "信息联防",
    "scene": "前点每次报出信息，后点就能及时补位。",
    "origin": "团队 · 补位协防",
    "verbs": {
      "init": "建立信息联防"
    },
    "note": "持续战术在每回合第一张先锋牌之后触发，不追溯此前已经打出的牌。"
  },
  "AM18": {
    "title": "赛场调度",
    "scene": "把每个人的行动排进节奏，让下一轮更从容。",
    "origin": "团队 · 指挥调度",
    "verbs": {
      "energy": "统一行动节奏",
      "extraDraw": "扩充战术预案"
    },
    "note": "行动点与升级后的额外抽牌从下一回合开始；多张能力仍按原规则叠加。"
  },
  "EU01": {
    "title": "抢线点射",
    "scene": "准星先到拐角，第一枪抢到身位。",
    "origin": "枪法 · 抢线",
    "verbs": {
      "hit": "抢线开枪"
    },
    "note": "通用枪法场景；不额外获得首杀奖励。"
  },
  "EU02": {
    "title": "压枪推进",
    "scene": "一轮交火压住对手，队伍稳步推进。",
    "note": "原创团队战术。所有收益按卡面规则逐项结算，不增加额外命中、击杀、地图位置或隐藏触发条件。",
    "origin": "团队 · 原创战术"
  },
  "EU03": {
    "title": "首枪破点",
    "scene": "准星停在头线，迎着枪声打开缺口。",
    "origin": "枪法 · 突破",
    "verbs": {
      "hit": "抢下首轮交火"
    },
    "note": "首枪是战术名称；任何回合都能打出，不要求本回合第一张。"
  },
  "EU04": {
    "title": "急停转火",
    "scene": "急停一枪，拉回准星再接一枪。",
    "origin": "枪法 · 连续转火",
    "verbs": {
      "hit": "连续转火"
    },
    "note": "两段攻击分别结算；没有新增敌人数或击杀触发。"
  },
  "EU05": {
    "title": "封锁反击",
    "scene": "反击结束后保持火力封锁，让对手难以提速。",
    "note": "原创团队战术。所有收益按卡面规则逐项结算，不增加额外命中、击杀、地图位置或隐藏触发条件。",
    "origin": "团队 · 原创战术"
  },
  "EU06": {
    "title": "关键回合突破",
    "scene": "关键回合，集中火力冲开对手的第一道防线。",
    "origin": "比赛 · 集中突破",
    "note": "原创枪法场景；不引用选手现实名场面，也不要求回合数或比分条件。"
  },
  "EU07": {
    "title": "入口阻滞",
    "scene": "陷阱配合架枪，迫使进攻队伍放慢脚步。",
    "note": "原创团队战术。所有收益按卡面规则逐项结算，不增加额外命中、击杀、地图位置或隐藏触发条件。",
    "origin": "团队 · 原创战术"
  },
  "EU08": {
    "title": "冰域拖延",
    "scene": "贤者的减速球铺开，第二颗先留在手中。",
    "origin": "贤者 · 减速球",
    "verbs": {
      "block": "减速拖住进攻",
      "token": "留出第二次封路"
    },
    "note": "减速在这里折算为布防，不另扣对手行动次数；第二颗球要打出生成的临时牌才生效。",
    "source": "https://playvalorant.com/en-us/agents/sage/"
  },
  "EU09": {
    "title": "冰墙封口",
    "scene": "贤者升起冰墙，让入口的火力先撞上墙。",
    "origin": "贤者 · 冰墙",
    "verbs": {
      "block": "冰墙承接火力"
    },
    "note": "墙体不作为独立单位；仅增加布防，按统一时机清空。",
    "source": "https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-11-08/"
  },
  "EU10": {
    "title": "腐坏逼退",
    "scene": "暮蝶抛出腐坏球，逼得对手暂缓前压。",
    "origin": "暮蝶 · 腐坏球",
    "verbs": {
      "weak": "腐坏逼退，形成压制"
    },
    "note": "Meddle 原作造成暂时腐坏；本牌取逼退与犹豫的场景，抽象为压制。不会扣当前或最大防线，也没有持续掉血。",
    "source": "https://playvalorant.com/en-us/agents/clove/"
  },
  "EU11": {
    "title": "交替掩护",
    "scene": "掩护队友换位，同时限制对方交火空间。",
    "note": "原创团队战术。所有收益按卡面规则逐项结算，不增加额外命中、击杀、地图位置或隐藏触发条件。",
    "origin": "团队 · 原创战术"
  },
  "EU12": {
    "title": "暗魇抢位",
    "scene": "幽影的暗魇穿过掩体，队友趁势调整站位。",
    "origin": "幽影 · 暗魇",
    "verbs": {
      "weak": "近视干扰，形成压制",
      "draw": "借机调整战术"
    },
    "note": "Paranoia 限制视野；抽牌表示队伍获得后续选择，不表示技能侦察或揭示敌人。",
    "source": "https://playvalorant.com/en-us/agents/omen/"
  },
  "EU13": {
    "title": "侦察探点",
    "scene": "猎枭的侦察箭落位，为下一步提供情报。",
    "origin": "猎枭 · 侦察箭",
    "verbs": {
      "draw": "侦察获得情报"
    },
    "note": "情报转为抽牌；不改变已公开的意图，也不查看抽牌顺序。",
    "source": "https://playvalorant.com/en-us/agents/sova/"
  },
  "EU14": {
    "title": "信息回防",
    "scene": "队友报告动向，先锋及时补上防守缺口。",
    "note": "原创团队战术。所有收益按卡面规则逐项结算，不增加额外命中、击杀、地图位置或隐藏触发条件。",
    "origin": "团队 · 原创战术"
  },
  "EU15": {
    "title": "穿墙闪击",
    "scene": "铁臂的闪光穿墙炸开，接枪窗口就在眼前。",
    "origin": "铁臂 · 穿墙闪光",
    "verbs": {
      "vulnerable": "闪光创造接枪窗口"
    },
    "note": "Flashpoint 原作致盲；本牌把接枪窗口抽象为易伤，不代表原作闪光自带增伤。不会跳过对手行动。",
    "source": "https://playvalorant.com/en-us/agents/breach/"
  },
  "EU16": {
    "title": "交叉拉枪",
    "scene": "侧翼持续牵扯，让突破手更容易打开第一枪。",
    "origin": "团队 · 交叉枪线",
    "verbs": {
      "duel": "建立交叉枪线"
    },
    "note": "自由人持续战术，只增强每回合第一张决斗牌的第一段攻击。"
  },
  "EU17": {
    "title": "协同防线",
    "scene": "先布置防线，再让每轮情报行动接上掩护。",
    "note": "原创团队战术。所有收益按卡面规则逐项结算，不增加额外命中、击杀、地图位置或隐藏触发条件。",
    "origin": "团队 · 原创战术"
  },
  "EU18": {
    "title": "赛场调度",
    "scene": "把每个人的行动排进节奏，让下一轮更从容。",
    "origin": "团队 · 指挥调度",
    "verbs": {
      "energy": "统一行动节奏",
      "extraDraw": "扩充战术预案"
    },
    "note": "行动点与升级后的额外抽牌从下一回合开始；多张能力仍按原规则叠加。"
  },
  "PA01": {
    "title": "抢线点射",
    "scene": "准星先到拐角，第一枪抢到身位。",
    "origin": "枪法 · 抢线",
    "verbs": {
      "hit": "抢线开枪"
    },
    "note": "通用枪法场景；不额外获得首杀奖励。"
  },
  "PA02": {
    "title": "提速接力",
    "scene": "第一枪拉开局面，留出补枪并准备后续行动。",
    "note": "原创团队战术。所有收益按卡面规则逐项结算，不增加额外命中、击杀、地图位置或隐藏触发条件。",
    "origin": "团队 · 原创战术"
  },
  "PA03": {
    "title": "首枪破点",
    "scene": "准星停在头线，迎着枪声打开缺口。",
    "origin": "枪法 · 突破",
    "verbs": {
      "hit": "抢下首轮交火"
    },
    "note": "首枪是战术名称；任何回合都能打出，不要求本回合第一张。"
  },
  "PA04": {
    "title": "攻守轮转",
    "scene": "前点交火后，队友准备一次临时封路。",
    "note": "原创团队战术。所有收益按卡面规则逐项结算，不增加额外命中、击杀、地图位置或隐藏触发条件。",
    "origin": "团队 · 原创战术"
  },
  "PA05": {
    "title": "抓住破绽",
    "scene": "对手被压在掩体后，立刻拉出补上火力。",
    "origin": "配合 · 压制后接枪",
    "verbs": {
      "hit": "抓时机出枪"
    },
    "note": "只有对手已有压制时才增加基础伤害；不要求低血量。"
  },
  "PA06": {
    "title": "关键回合突破",
    "scene": "关键回合，集中火力冲开对手的第一道防线。",
    "origin": "比赛 · 集中突破",
    "note": "原创枪法场景；不引用选手现实名场面，也不要求回合数或比分条件。"
  },
  "PA07": {
    "title": "分段封路",
    "scene": "先封住一个入口，另一道部署留待使用。",
    "note": "原创团队战术。所有收益按卡面规则逐项结算，不增加额外命中、击杀、地图位置或隐藏触发条件。",
    "origin": "团队 · 原创战术"
  },
  "PA08": {
    "title": "侦防同步",
    "scene": "布好入口的防守，再根据情报调整下一步。",
    "note": "原创团队战术。所有收益按卡面规则逐项结算，不增加额外命中、击杀、地图位置或隐藏触发条件。",
    "origin": "团队 · 原创战术"
  },
  "PA09": {
    "title": "冰墙封口",
    "scene": "贤者升起冰墙，让入口的火力先撞上墙。",
    "origin": "贤者 · 冰墙",
    "verbs": {
      "block": "冰墙承接火力"
    },
    "note": "墙体不作为独立单位；仅增加布防，按统一时机清空。",
    "source": "https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-11-08/"
  },
  "PA10": {
    "title": "腐坏逼退",
    "scene": "暮蝶抛出腐坏球，逼得对手暂缓前压。",
    "origin": "暮蝶 · 腐坏球",
    "verbs": {
      "weak": "腐坏逼退，形成压制"
    },
    "note": "Meddle 原作造成暂时腐坏；本牌取逼退与犹豫的场景，抽象为压制。不会扣当前或最大防线，也没有持续掉血。",
    "source": "https://playvalorant.com/en-us/agents/clove/"
  },
  "PA11": {
    "title": "毒幕分割",
    "scene": "蝰蛇拉起毒幕，切开入口两侧的枪线。",
    "origin": "蝰蛇 · 毒幕",
    "verbs": {
      "block": "毒幕掩护队友",
      "weak": "分割枪线，形成压制"
    },
    "note": "取 Toxic Screen 分割视野与阻滞进攻的场景；不新增中毒、腐坏、持续伤害或跨比赛隐患。",
    "source": "https://playvalorant.com/en-us/news/game-updates/valorant-patch-notes-1-02/"
  },
  "PA12": {
    "title": "暗魇抢位",
    "scene": "幽影的暗魇穿过掩体，队友趁势调整站位。",
    "origin": "幽影 · 暗魇",
    "verbs": {
      "weak": "近视干扰，形成压制",
      "draw": "借机调整战术"
    },
    "note": "Paranoia 限制视野；抽牌表示队伍获得后续选择，不表示技能侦察或揭示敌人。",
    "source": "https://playvalorant.com/en-us/agents/omen/"
  },
  "PA13": {
    "title": "侦察探点",
    "scene": "猎枭的侦察箭落位，为下一步提供情报。",
    "origin": "猎枭 · 侦察箭",
    "verbs": {
      "draw": "侦察获得情报"
    },
    "note": "情报转为抽牌；不改变已公开的意图，也不查看抽牌顺序。",
    "source": "https://playvalorant.com/en-us/agents/sova/"
  },
  "PA14": {
    "title": "情报接枪",
    "scene": "情报送到，补枪队友随时准备跟进。",
    "note": "原创团队战术。所有收益按卡面规则逐项结算，不增加额外命中、击杀、地图位置或隐藏触发条件。",
    "origin": "团队 · 原创战术"
  },
  "PA15": {
    "title": "穿墙闪击",
    "scene": "铁臂的闪光穿墙炸开，接枪窗口就在眼前。",
    "origin": "铁臂 · 穿墙闪光",
    "verbs": {
      "vulnerable": "闪光创造接枪窗口"
    },
    "note": "Flashpoint 原作致盲；本牌把接枪窗口抽象为易伤，不代表原作闪光自带增伤。不会跳过对手行动。",
    "source": "https://playvalorant.com/en-us/agents/breach/"
  },
  "PA16": {
    "title": "交叉拉枪",
    "scene": "侧翼持续牵扯，让突破手更容易打开第一枪。",
    "origin": "团队 · 交叉枪线",
    "verbs": {
      "duel": "建立交叉枪线"
    },
    "note": "自由人持续战术，只增强每回合第一张决斗牌的第一段攻击。"
  },
  "PA17": {
    "title": "轮转指挥",
    "scene": "持续补充行动选择，让先锋每轮都有协同掩护。",
    "note": "原创团队战术。所有收益按卡面规则逐项结算，不增加额外命中、击杀、地图位置或隐藏触发条件。",
    "origin": "团队 · 原创战术"
  },
  "PA18": {
    "title": "赛场调度",
    "scene": "把每个人的行动排进节奏，让下一轮更从容。",
    "origin": "团队 · 指挥调度",
    "verbs": {
      "energy": "统一行动节奏",
      "extraDraw": "扩充战术预案"
    },
    "note": "行动点与升级后的额外抽牌从下一回合开始；多张能力仍按原规则叠加。"
  }
};
