// DeepSeek drafts reviewed for schema and integrated as regional PvE cards.
export const REGIONAL_CARDS = [
  {
    "id": "CNT01",
    "name": "布防掩护",
    "cost": 1,
    "type": "skill",
    "tag": "stance",
    "rarity": "common",
    "effects": [
      {
        "type": "block",
        "n": 5
      },
      {
        "type": "stanceSwitch"
      }
    ],
    "upgradeEffects": [
      {
        "type": "block",
        "n": 8
      },
      {
        "type": "stanceSwitch"
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT02",
    "name": "前压点射",
    "cost": 1,
    "type": "attack",
    "tag": "stance",
    "rarity": "common",
    "effects": [
      {
        "type": "attack",
        "n": 7
      },
      {
        "type": "stanceSwitch"
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 10
      },
      {
        "type": "stanceSwitch"
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT03",
    "name": "战术布置",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "block",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "block",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT04",
    "name": "快速复盘",
    "cost": 0,
    "type": "skill",
    "tag": "response",
    "rarity": "common",
    "effects": [
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "energy",
        "n": 1
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "energy",
        "n": 1
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "CN"
  },
  {
    "id": "CNT05",
    "name": "阵地加固",
    "cost": 2,
    "type": "skill",
    "tag": "stance",
    "rarity": "common",
    "effects": [
      {
        "type": "block",
        "n": 10
      }
    ],
    "upgradeEffects": [
      {
        "type": "block",
        "n": 14
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT06",
    "name": "火力侦察",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "common",
    "effects": [
      {
        "type": "attack",
        "n": 6
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 8
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT07",
    "name": "战术闪避",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "smoke",
        "n": 2
      },
      {
        "type": "block",
        "n": 4
      }
    ],
    "upgradeEffects": [
      {
        "type": "smoke",
        "n": 3
      },
      {
        "type": "block",
        "n": 6
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT08",
    "name": "闪光干扰",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "flash",
        "n": 2
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "flash",
        "n": 3
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT09",
    "name": "稳定射击",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "common",
    "effects": [
      {
        "type": "attack",
        "n": 8
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 11
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT10",
    "name": "防御工事",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "block",
        "n": 6
      }
    ],
    "upgradeEffects": [
      {
        "type": "block",
        "n": 9
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT11",
    "name": "战术部署",
    "cost": 2,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "block",
        "n": 8
      },
      {
        "type": "draw",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "block",
        "n": 11
      },
      {
        "type": "draw",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT12",
    "name": "精准打击",
    "cost": 2,
    "type": "attack",
    "tag": "damage",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 13
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 17
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT13",
    "name": "毒烟弹",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "smoke",
        "n": 2
      },
      {
        "type": "weak",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "smoke",
        "n": 3
      },
      {
        "type": "weak",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT14",
    "name": "电击手雷",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 4
      },
      {
        "type": "vuln",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 6
      },
      {
        "type": "vuln",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT15",
    "name": "交替掩护",
    "cost": 1,
    "type": "skill",
    "tag": "stance",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "stanceSwitch"
      },
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "block",
        "n": 3
      }
    ],
    "upgradeEffects": [
      {
        "type": "stanceSwitch"
      },
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "block",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT16",
    "name": "前压闪击",
    "cost": 1,
    "type": "attack",
    "tag": "stance",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "stanceSwitch"
      },
      {
        "type": "attack",
        "n": 5
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "stanceSwitch"
      },
      {
        "type": "attack",
        "n": 7
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT17",
    "name": "满配弹匣",
    "cost": 0,
    "type": "skill",
    "tag": "response",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "energy",
        "n": 2
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "energy",
        "n": 2
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "CN"
  },
  {
    "id": "CNT18",
    "name": "战术封锁",
    "cost": 2,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "smoke",
        "n": 4
      },
      {
        "type": "block",
        "n": 6
      }
    ],
    "upgradeEffects": [
      {
        "type": "smoke",
        "n": 6
      },
      {
        "type": "block",
        "n": 9
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT19",
    "name": "弱点暴露",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "vuln",
        "n": 2
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "vuln",
        "n": 3
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT20",
    "name": "压制射击",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 5
      },
      {
        "type": "weak",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 7
      },
      {
        "type": "weak",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT21",
    "name": "战术后撤",
    "cost": 1,
    "type": "skill",
    "tag": "stance",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "stanceSwitch"
      },
      {
        "type": "block",
        "n": 4
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "stanceSwitch"
      },
      {
        "type": "block",
        "n": 6
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT22",
    "name": "突击手雷",
    "cost": 2,
    "type": "attack",
    "tag": "damage",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 8
      },
      {
        "type": "vuln",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 11
      },
      {
        "type": "vuln",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT23",
    "name": "情报收集",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "block",
        "n": 3
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 3
      },
      {
        "type": "block",
        "n": 4
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT24",
    "name": "精确计算",
    "cost": 1,
    "type": "skill",
    "tag": "response",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "energy",
        "n": 1
      },
      {
        "type": "block",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "energy",
        "n": 1
      },
      {
        "type": "block",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT25",
    "name": "烟雾中前进",
    "cost": 1,
    "type": "skill",
    "tag": "hybrid",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "smoke",
        "n": 2
      },
      {
        "type": "conditional",
        "condition": "enemy_smoke",
        "effect": {
          "type": "block",
          "n": 5
        }
      }
    ],
    "upgradeEffects": [
      {
        "type": "smoke",
        "n": 3
      },
      {
        "type": "conditional",
        "condition": "enemy_smoke",
        "effect": {
          "type": "block",
          "n": 7
        }
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT26",
    "name": "闪光中突袭",
    "cost": 1,
    "type": "attack",
    "tag": "hybrid",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "flash",
        "n": 2
      },
      {
        "type": "conditional",
        "condition": "enemy_flash",
        "effect": {
          "type": "attack",
          "n": 6
        }
      }
    ],
    "upgradeEffects": [
      {
        "type": "flash",
        "n": 3
      },
      {
        "type": "conditional",
        "condition": "enemy_flash",
        "effect": {
          "type": "attack",
          "n": 8
        }
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT27",
    "name": "布防反击阵型",
    "cost": 2,
    "type": "attack",
    "tag": "stance",
    "rarity": "rare",
    "effects": [
      {
        "type": "conditional",
        "condition": "stance_cover",
        "effect": {
          "type": "attack",
          "n": 10
        }
      },
      {
        "type": "block",
        "n": 5
      }
    ],
    "upgradeEffects": [
      {
        "type": "conditional",
        "condition": "stance_cover",
        "effect": {
          "type": "attack",
          "n": 14
        }
      },
      {
        "type": "block",
        "n": 7
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT28",
    "name": "前压突破阵型",
    "cost": 2,
    "type": "skill",
    "tag": "stance",
    "rarity": "rare",
    "effects": [
      {
        "type": "conditional",
        "condition": "stance_push",
        "effect": {
          "type": "block",
          "n": 12
        }
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "conditional",
        "condition": "stance_push",
        "effect": {
          "type": "block",
          "n": 16
        }
      },
      {
        "type": "draw",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT29",
    "name": "战术调度",
    "cost": 3,
    "type": "skill",
    "tag": "core",
    "rarity": "rare",
    "effects": [
      {
        "type": "draw",
        "n": 4
      },
      {
        "type": "energy",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 5
      },
      {
        "type": "energy",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT30",
    "name": "全面回溯",
    "cost": 1,
    "type": "skill",
    "tag": "core",
    "rarity": "rare",
    "effects": [
      {
        "type": "upgradeAllInHand"
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "upgradeAllInHand"
      },
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "CN"
  },
  {
    "id": "CNT31",
    "name": "战前整备",
    "cost": 2,
    "type": "skill",
    "tag": "core",
    "rarity": "rare",
    "effects": [
      {
        "type": "upgradeAllInCombatDeck"
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "upgradeAllInCombatDeck"
      },
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "CN"
  },
  {
    "id": "CNT32",
    "name": "精准强化",
    "cost": 1,
    "type": "attack",
    "tag": "hybrid",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attackScaledByUpgradedHand",
        "base": 4,
        "per": 2,
        "cap": 3
      }
    ],
    "upgradeEffects": [
      {
        "type": "attackScaledByUpgradedHand",
        "base": 6,
        "per": 2,
        "cap": 4
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT33",
    "name": "升级弹幕",
    "cost": 2,
    "type": "attack",
    "tag": "hybrid",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attackScaledByUpgradedHand",
        "base": 4,
        "per": 3,
        "cap": 5
      }
    ],
    "upgradeEffects": [
      {
        "type": "attackScaledByUpgradedHand",
        "base": 6,
        "per": 3,
        "cap": 5
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT34",
    "name": "缴获物资",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "money",
        "n": 10
      }
    ],
    "upgradeEffects": [
      {
        "type": "money",
        "n": 15
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT35",
    "name": "战地急救",
    "cost": 1,
    "type": "skill",
    "tag": "response",
    "rarity": "common",
    "effects": [
      {
        "type": "heal",
        "n": 5
      }
    ],
    "upgradeEffects": [
      {
        "type": "heal",
        "n": 8
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT36",
    "name": "体魄强化",
    "cost": 1,
    "type": "skill",
    "tag": "response",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "heal",
        "n": 6
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "heal",
        "n": 9
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "CN"
  },
  {
    "id": "CNT37",
    "name": "清除虚弱",
    "cost": 0,
    "type": "skill",
    "tag": "response",
    "rarity": "common",
    "effects": [
      {
        "type": "purgePlayerStatus",
        "id": "weak",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "purgePlayerStatus",
        "id": "weak",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT38",
    "name": "解除脆弱",
    "cost": 0,
    "type": "skill",
    "tag": "response",
    "rarity": "common",
    "effects": [
      {
        "type": "purgePlayerStatus",
        "id": "vuln",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "purgePlayerStatus",
        "id": "vuln",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT39",
    "name": "完全净化",
    "cost": 1,
    "type": "skill",
    "tag": "response",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "purgePlayerStatus",
        "id": "weak",
        "n": 99
      },
      {
        "type": "purgePlayerStatus",
        "id": "vuln",
        "n": 99
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "purgePlayerStatus",
        "id": "weak",
        "n": 99
      },
      {
        "type": "purgePlayerStatus",
        "id": "vuln",
        "n": 99
      },
      {
        "type": "draw",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT40",
    "name": "破防闪光",
    "cost": 1,
    "type": "skill",
    "tag": "response",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "purgeEnemyStatus",
        "id": "block",
        "n": 99
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "purgeEnemyStatus",
        "id": "block",
        "n": 99
      },
      {
        "type": "draw",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT41",
    "name": "紧急调度",
    "cost": 0,
    "type": "skill",
    "tag": "response",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "draw",
        "n": 3
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 4
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "CN"
  },
  {
    "id": "CNT42",
    "name": "临时能量",
    "cost": 0,
    "type": "skill",
    "tag": "response",
    "rarity": "common",
    "effects": [
      {
        "type": "energy",
        "n": 2
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "energy",
        "n": 3
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "CN"
  },
  {
    "id": "CNT43",
    "name": "战术笔记",
    "cost": 1,
    "type": "skill",
    "tag": "response",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "block",
        "n": 6
      },
      {
        "type": "upgradeRandomInHand"
      }
    ],
    "upgradeEffects": [
      {
        "type": "block",
        "n": 9
      },
      {
        "type": "upgradeRandomInHand"
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT44",
    "name": "集体回溯",
    "cost": 1,
    "type": "skill",
    "tag": "core",
    "rarity": "rare",
    "effects": [
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "block",
        "n": 6
      },
      {
        "type": "upgradeAllInHand"
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "block",
        "n": 8
      },
      {
        "type": "upgradeAllInHand"
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "CN"
  },
  {
    "id": "CNT45",
    "name": "临场提升",
    "cost": 0,
    "type": "skill",
    "tag": "response",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "upgradeRandomInHand"
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "upgradeRandomInHand"
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "CN"
  },
  {
    "id": "CNT46",
    "name": "烟中复盘",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "smoke",
        "n": 3
      },
      {
        "type": "conditional",
        "condition": "enemy_smoke",
        "effect": {
          "type": "upgradeRandomInHand"
        }
      },
      {
        "type": "block",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "smoke",
        "n": 4
      },
      {
        "type": "conditional",
        "condition": "enemy_smoke",
        "effect": {
          "type": "upgradeRandomInHand"
        }
      },
      {
        "type": "block",
        "n": 4
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT47",
    "name": "火力协同",
    "cost": 2,
    "type": "attack",
    "tag": "hybrid",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 6
      },
      {
        "type": "conditional",
        "condition": "prev_played_attack",
        "effect": {
          "type": "attack",
          "n": 6
        }
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 8
      },
      {
        "type": "conditional",
        "condition": "prev_played_attack",
        "effect": {
          "type": "attack",
          "n": 8
        }
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT48",
    "name": "首次交火",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "conditional",
        "condition": "first_attack_this_turn",
        "effect": {
          "type": "attack",
          "n": 12
        }
      },
      {
        "type": "attack",
        "n": 4
      }
    ],
    "upgradeEffects": [
      {
        "type": "conditional",
        "condition": "first_attack_this_turn",
        "effect": {
          "type": "attack",
          "n": 16
        }
      },
      {
        "type": "attack",
        "n": 5
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT49",
    "name": "首次布防",
    "cost": 1,
    "type": "skill",
    "tag": "stance",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "conditional",
        "condition": "first_block_this_turn",
        "effect": {
          "type": "block",
          "n": 12
        }
      },
      {
        "type": "block",
        "n": 4
      }
    ],
    "upgradeEffects": [
      {
        "type": "conditional",
        "condition": "first_block_this_turn",
        "effect": {
          "type": "block",
          "n": 16
        }
      },
      {
        "type": "block",
        "n": 5
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT50",
    "name": "姿态冲击",
    "cost": 2,
    "type": "attack",
    "tag": "hybrid",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 10
      },
      {
        "type": "conditional",
        "condition": "stance_changed_this_turn",
        "effect": {
          "type": "attack",
          "n": 6
        }
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 13
      },
      {
        "type": "conditional",
        "condition": "stance_changed_this_turn",
        "effect": {
          "type": "attack",
          "n": 8
        }
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT51",
    "name": "防御姿态",
    "cost": 1,
    "type": "skill",
    "tag": "stance",
    "rarity": "common",
    "effects": [
      {
        "type": "stanceSwitch"
      },
      {
        "type": "block",
        "n": 3
      }
    ],
    "upgradeEffects": [
      {
        "type": "stanceSwitch"
      },
      {
        "type": "block",
        "n": 5
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT52",
    "name": "攻击姿态",
    "cost": 1,
    "type": "skill",
    "tag": "stance",
    "rarity": "common",
    "effects": [
      {
        "type": "stanceSwitch"
      },
      {
        "type": "attack",
        "n": 3
      }
    ],
    "upgradeEffects": [
      {
        "type": "stanceSwitch"
      },
      {
        "type": "attack",
        "n": 5
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT53",
    "name": "烟雾弹雨",
    "cost": 2,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "smoke",
        "n": 6
      }
    ],
    "upgradeEffects": [
      {
        "type": "smoke",
        "n": 9
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT54",
    "name": "闪光弹幕",
    "cost": 2,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "flash",
        "n": 6
      }
    ],
    "upgradeEffects": [
      {
        "type": "flash",
        "n": 9
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT55",
    "name": "烟幕闪光",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "smoke",
        "n": 2
      },
      {
        "type": "flash",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "smoke",
        "n": 3
      },
      {
        "type": "flash",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT56",
    "name": "道具补给",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "money",
        "n": 5
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 3
      },
      {
        "type": "money",
        "n": 5
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT57",
    "name": "全息诱饵",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "weak",
        "n": 3
      }
    ],
    "upgradeEffects": [
      {
        "type": "weak",
        "n": 5
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT58",
    "name": "破片手雷",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 5
      },
      {
        "type": "vuln",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 7
      },
      {
        "type": "vuln",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT59",
    "name": "连续射击",
    "cost": 2,
    "type": "attack",
    "tag": "damage",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 4,
        "times": 3
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 5,
        "times": 3
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT60",
    "name": "爆裂弹头",
    "cost": 2,
    "type": "attack",
    "tag": "damage",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 15
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 20
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "CN"
  },
  {
    "id": "CNT61",
    "name": "防御反击",
    "cost": 2,
    "type": "attack",
    "tag": "hybrid",
    "rarity": "rare",
    "effects": [
      {
        "type": "attack",
        "n": 8
      },
      {
        "type": "block",
        "n": 5
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 11
      },
      {
        "type": "block",
        "n": 7
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT62",
    "name": "战术撤退",
    "cost": 1,
    "type": "skill",
    "tag": "response",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "block",
        "n": 6
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "block",
        "n": 9
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT63",
    "name": "紧急支援",
    "cost": 1,
    "type": "skill",
    "tag": "response",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "block",
        "n": 4
      },
      {
        "type": "heal",
        "n": 3
      }
    ],
    "upgradeEffects": [
      {
        "type": "block",
        "n": 6
      },
      {
        "type": "heal",
        "n": 5
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT64",
    "name": "双重威胁",
    "cost": 2,
    "type": "attack",
    "tag": "hybrid",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 7
      },
      {
        "type": "smoke",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 10
      },
      {
        "type": "smoke",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT65",
    "name": "闪光突袭",
    "cost": 2,
    "type": "attack",
    "tag": "hybrid",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 6
      },
      {
        "type": "flash",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 8
      },
      {
        "type": "flash",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT66",
    "name": "战略休整",
    "cost": 1,
    "type": "skill",
    "tag": "response",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "heal",
        "n": 4
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "heal",
        "n": 6
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT67",
    "name": "烟雾掩护",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "smoke",
        "n": 3
      }
    ],
    "upgradeEffects": [
      {
        "type": "smoke",
        "n": 5
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT68",
    "name": "闪光掩护",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "flash",
        "n": 3
      }
    ],
    "upgradeEffects": [
      {
        "type": "flash",
        "n": 5
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT69",
    "name": "侦察行动",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "draw",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT70",
    "name": "弹药补充",
    "cost": 0,
    "type": "skill",
    "tag": "response",
    "rarity": "common",
    "effects": [
      {
        "type": "energy",
        "n": 1
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "energy",
        "n": 2
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "CN"
  },
  {
    "id": "CNT71",
    "name": "集中火力",
    "cost": 3,
    "type": "attack",
    "tag": "damage",
    "rarity": "rare",
    "effects": [
      {
        "type": "attack",
        "n": 20
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 26
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT72",
    "name": "防御工事强化",
    "cost": 3,
    "type": "skill",
    "tag": "stance",
    "rarity": "rare",
    "effects": [
      {
        "type": "block",
        "n": 20
      }
    ],
    "upgradeEffects": [
      {
        "type": "block",
        "n": 26
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT73",
    "name": "终极回溯",
    "cost": 3,
    "type": "skill",
    "tag": "core",
    "rarity": "rare",
    "effects": [
      {
        "type": "upgradeAllInCombatDeck"
      },
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "upgradeAllInCombatDeck"
      },
      {
        "type": "draw",
        "n": 3
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "CN"
  },
  {
    "id": "CNT74",
    "name": "战术狂潮",
    "cost": 3,
    "type": "skill",
    "tag": "utility",
    "rarity": "rare",
    "effects": [
      {
        "type": "energy",
        "n": 3
      },
      {
        "type": "draw",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "energy",
        "n": 4
      },
      {
        "type": "draw",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "CNT75",
    "name": "压制清除",
    "cost": 1,
    "type": "attack",
    "tag": "response",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "purgeEnemyStatus",
        "id": "weak",
        "n": 99
      },
      {
        "type": "attack",
        "n": 6
      }
    ],
    "upgradeEffects": [
      {
        "type": "purgeEnemyStatus",
        "id": "weak",
        "n": 99
      },
      {
        "type": "attack",
        "n": 9
      }
    ],
    "exhaust": false,
    "region": "CN"
  },
  {
    "id": "AMT01",
    "name": "点射",
    "cost": 0,
    "type": "attack",
    "tag": "damage",
    "rarity": "common",
    "effects": [
      {
        "type": "attack",
        "n": 3,
        "times": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 5,
        "times": 1
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT02",
    "name": "双发压制",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "common",
    "effects": [
      {
        "type": "attack",
        "n": 5,
        "times": 2
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 7,
        "times": 2
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "AM"
  },
  {
    "id": "AMT03",
    "name": "机动展开",
    "cost": 0,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "block",
        "n": 4
      },
      {
        "type": "conditional",
        "condition": "stance_cover",
        "effect": {
          "type": "block",
          "n": 3
        }
      }
    ],
    "upgradeEffects": [
      {
        "type": "block",
        "n": 6
      },
      {
        "type": "conditional",
        "condition": "stance_cover",
        "effect": {
          "type": "block",
          "n": 4
        }
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT04",
    "name": "战术翻滚",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "block",
        "n": 3
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "block",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT05",
    "name": "破片侵彻",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "common",
    "effects": [
      {
        "type": "attack",
        "n": 6,
        "times": 1
      },
      {
        "type": "vuln",
        "n": 1,
        "times": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 8,
        "times": 1
      },
      {
        "type": "vuln",
        "n": 2,
        "times": 1
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT06",
    "name": "锁定射击",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "common",
    "effects": [
      {
        "type": "attack",
        "n": 6,
        "times": 1
      },
      {
        "type": "conditional",
        "condition": "enemy_smoke",
        "effect": {
          "type": "attack",
          "n": 3,
          "times": 1
        }
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 9,
        "times": 1
      },
      {
        "type": "conditional",
        "condition": "enemy_smoke",
        "effect": {
          "type": "attack",
          "n": 4,
          "times": 1
        }
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT07",
    "name": "烟雾屏障",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "smoke",
        "n": 2,
        "times": 1
      },
      {
        "type": "block",
        "n": 3
      }
    ],
    "upgradeEffects": [
      {
        "type": "smoke",
        "n": 3,
        "times": 1
      },
      {
        "type": "block",
        "n": 5
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT08",
    "name": "致盲闪光",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "flash",
        "n": 2,
        "times": 1
      },
      {
        "type": "block",
        "n": 3
      }
    ],
    "upgradeEffects": [
      {
        "type": "flash",
        "n": 3,
        "times": 1
      },
      {
        "type": "block",
        "n": 5
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT09",
    "name": "战术换弹",
    "cost": 0,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "energy",
        "n": 1
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "energy",
        "n": 1
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "AM"
  },
  {
    "id": "AMT10",
    "name": "侦察射击",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "common",
    "effects": [
      {
        "type": "attack",
        "n": 4,
        "times": 1
      },
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "conditional",
        "condition": "enemy_flash",
        "effect": {
          "type": "draw",
          "n": 1
        }
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 6,
        "times": 1
      },
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "conditional",
        "condition": "enemy_flash",
        "effect": {
          "type": "draw",
          "n": 1
        }
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT11",
    "name": "稳固据守",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "block",
        "n": 7
      }
    ],
    "upgradeEffects": [
      {
        "type": "block",
        "n": 10
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT12",
    "name": "交叉火力",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "common",
    "effects": [
      {
        "type": "attack",
        "n": 3,
        "times": 3
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 4,
        "times": 3
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT13",
    "name": "易伤标记",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "vuln",
        "n": 2,
        "times": 1
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "vuln",
        "n": 3,
        "times": 1
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT14",
    "name": "灵动侧击",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "common",
    "effects": [
      {
        "type": "attack",
        "n": 6,
        "times": 1
      },
      {
        "type": "block",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 8,
        "times": 1
      },
      {
        "type": "block",
        "n": 4
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT15",
    "name": "短暂停火",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "block",
        "n": 5
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "block",
        "n": 8
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT16",
    "name": "烟雾弹幕",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "smoke",
        "n": 3,
        "times": 1
      },
      {
        "type": "block",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "smoke",
        "n": 4,
        "times": 1
      },
      {
        "type": "block",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT17",
    "name": "闪光拦截",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "flash",
        "n": 2,
        "times": 1
      },
      {
        "type": "block",
        "n": 4
      }
    ],
    "upgradeEffects": [
      {
        "type": "flash",
        "n": 3,
        "times": 1
      },
      {
        "type": "block",
        "n": 6
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT18",
    "name": "紧急止血",
    "cost": 1,
    "type": "skill",
    "tag": "response",
    "rarity": "common",
    "effects": [
      {
        "type": "heal",
        "n": 5
      },
      {
        "type": "block",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "heal",
        "n": 8
      },
      {
        "type": "block",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT19",
    "name": "穿透弹",
    "cost": 2,
    "type": "attack",
    "tag": "damage",
    "rarity": "common",
    "effects": [
      {
        "type": "attack",
        "n": 13,
        "times": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 17,
        "times": 1
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT20",
    "name": "弹幕掩护",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 5,
        "times": 1
      },
      {
        "type": "vuln",
        "n": 1,
        "times": 1
      },
      {
        "type": "block",
        "n": 3
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 7,
        "times": 1
      },
      {
        "type": "vuln",
        "n": 1,
        "times": 1
      },
      {
        "type": "block",
        "n": 5
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT21",
    "name": "弱点洞悉",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "vuln",
        "n": 3,
        "times": 1
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "vuln",
        "n": 4,
        "times": 1
      },
      {
        "type": "draw",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT22",
    "name": "快速点射",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 4,
        "times": 2
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 6,
        "times": 2
      },
      {
        "type": "draw",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT23",
    "name": "战术烟雾",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "smoke",
        "n": 4,
        "times": 1
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "smoke",
        "n": 5,
        "times": 1
      },
      {
        "type": "draw",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT24",
    "name": "战术闪光",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "flash",
        "n": 4,
        "times": 1
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "flash",
        "n": 5,
        "times": 1
      },
      {
        "type": "draw",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT25",
    "name": "蓄势待发",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "block",
        "n": 5
      },
      {
        "type": "energy",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "block",
        "n": 8
      },
      {
        "type": "energy",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT26",
    "name": "破甲射击",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 6,
        "times": 1
      },
      {
        "type": "vuln",
        "n": 2,
        "times": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 8,
        "times": 1
      },
      {
        "type": "vuln",
        "n": 3,
        "times": 1
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT27",
    "name": "疾步突进",
    "cost": 0,
    "type": "attack",
    "tag": "damage",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 4,
        "times": 1
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 6,
        "times": 1
      },
      {
        "type": "draw",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT28",
    "name": "战术机动",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "block",
        "n": 4
      },
      {
        "type": "draw",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "block",
        "n": 6
      },
      {
        "type": "draw",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT29",
    "name": "支援射击",
    "cost": 2,
    "type": "attack",
    "tag": "damage",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 7,
        "times": 1
      },
      {
        "type": "block",
        "n": 4
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 9,
        "times": 1
      },
      {
        "type": "block",
        "n": 6
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT30",
    "name": "精确打击",
    "cost": 2,
    "type": "attack",
    "tag": "damage",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 10,
        "times": 1
      },
      {
        "type": "vuln",
        "n": 1,
        "times": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 14,
        "times": 1
      },
      {
        "type": "vuln",
        "n": 2,
        "times": 1
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT31",
    "name": "连射压制",
    "cost": 2,
    "type": "attack",
    "tag": "damage",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 7,
        "times": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 9,
        "times": 2
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT32",
    "name": "弹幕削防",
    "cost": 2,
    "type": "attack",
    "tag": "damage",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 4,
        "times": 3
      },
      {
        "type": "purgeEnemyStatus",
        "id": "block",
        "n": 4
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 5,
        "times": 3
      },
      {
        "type": "purgeEnemyStatus",
        "id": "block",
        "n": 6
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT33",
    "name": "战术换弹",
    "cost": 1,
    "type": "attack",
    "tag": "hybrid",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 6,
        "times": 1
      },
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "block",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 8,
        "times": 1
      },
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "block",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT34",
    "name": "闪避掩护",
    "cost": 0,
    "type": "skill",
    "tag": "utility",
    "rarity": "rare",
    "effects": [
      {
        "type": "block",
        "n": 3
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "block",
        "n": 5
      },
      {
        "type": "draw",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT35",
    "name": "致命节奏",
    "cost": 1,
    "type": "skill",
    "tag": "core",
    "rarity": "rare",
    "effects": [
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "energy",
        "n": 1
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "energy",
        "n": 2
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "AM"
  },
  {
    "id": "AMT36",
    "name": "战术洞察",
    "cost": 1,
    "type": "skill",
    "tag": "core",
    "rarity": "rare",
    "effects": [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "block",
        "n": 3
      },
      {
        "type": "conditional",
        "condition": "stance_changed_this_turn",
        "effect": {
          "type": "draw",
          "n": 1
        }
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 3
      },
      {
        "type": "block",
        "n": 4
      },
      {
        "type": "conditional",
        "condition": "stance_changed_this_turn",
        "effect": {
          "type": "draw",
          "n": 1
        }
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT37",
    "name": "战地恢复",
    "cost": 1,
    "type": "skill",
    "tag": "response",
    "rarity": "rare",
    "effects": [
      {
        "type": "heal",
        "n": 5
      },
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "block",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "heal",
        "n": 8
      },
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "block",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT38",
    "name": "净化自身",
    "cost": 0,
    "type": "skill",
    "tag": "response",
    "rarity": "rare",
    "effects": [
      {
        "type": "purgePlayerStatus",
        "id": "weak",
        "n": 2
      },
      {
        "type": "purgePlayerStatus",
        "id": "vuln",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "purgePlayerStatus",
        "id": "weak",
        "n": 3
      },
      {
        "type": "purgePlayerStatus",
        "id": "vuln",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT39",
    "name": "破防侦察",
    "cost": 1,
    "type": "skill",
    "tag": "response",
    "rarity": "rare",
    "effects": [
      {
        "type": "purgeEnemyStatus",
        "id": "block",
        "n": 99
      },
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "block",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "purgeEnemyStatus",
        "id": "block",
        "n": 99
      },
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "block",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT40",
    "name": "临场升级",
    "cost": 0,
    "type": "skill",
    "tag": "core",
    "rarity": "rare",
    "effects": [
      {
        "type": "upgradeRandomInHand",
        "times": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "upgradeRandomInHand",
        "times": 1
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT41",
    "name": "全员升级",
    "cost": 2,
    "type": "skill",
    "tag": "core",
    "rarity": "rare",
    "effects": [
      {
        "type": "upgradeAllInHand",
        "times": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "upgradeAllInHand",
        "times": 1
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT42",
    "name": "手牌强化",
    "cost": 1,
    "type": "attack",
    "tag": "hybrid",
    "rarity": "rare",
    "effects": [
      {
        "type": "attackScaledByUpgradedHand",
        "base": 5,
        "per": 3,
        "cap": 5
      }
    ],
    "upgradeEffects": [
      {
        "type": "attackScaledByUpgradedHand",
        "base": 7,
        "per": 4,
        "cap": 5
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT43",
    "name": "烟雾战场",
    "cost": 2,
    "type": "skill",
    "tag": "core",
    "rarity": "rare",
    "effects": [
      {
        "type": "smoke",
        "n": 3,
        "times": 1
      },
      {
        "type": "block",
        "n": 4
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "smoke",
        "n": 4,
        "times": 1
      },
      {
        "type": "block",
        "n": 6
      },
      {
        "type": "draw",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT44",
    "name": "闪光战场",
    "cost": 2,
    "type": "skill",
    "tag": "core",
    "rarity": "rare",
    "effects": [
      {
        "type": "flash",
        "n": 3,
        "times": 1
      },
      {
        "type": "block",
        "n": 4
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "flash",
        "n": 4,
        "times": 1
      },
      {
        "type": "block",
        "n": 6
      },
      {
        "type": "draw",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT45",
    "name": "战术补给",
    "cost": 2,
    "type": "skill",
    "tag": "core",
    "rarity": "rare",
    "effects": [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "energy",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 3
      },
      {
        "type": "energy",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT46",
    "name": "强攻姿态",
    "cost": 1,
    "type": "attack",
    "tag": "stance",
    "rarity": "rare",
    "effects": [
      {
        "type": "stanceSwitch",
        "times": 1
      },
      {
        "type": "attack",
        "n": 5,
        "times": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "stanceSwitch",
        "times": 1
      },
      {
        "type": "attack",
        "n": 8,
        "times": 1
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT47",
    "name": "掩护姿态",
    "cost": 1,
    "type": "skill",
    "tag": "stance",
    "rarity": "rare",
    "effects": [
      {
        "type": "stanceSwitch",
        "times": 1
      },
      {
        "type": "block",
        "n": 5
      }
    ],
    "upgradeEffects": [
      {
        "type": "stanceSwitch",
        "times": 1
      },
      {
        "type": "block",
        "n": 8
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT48",
    "name": "姿态转换",
    "cost": 0,
    "type": "skill",
    "tag": "stance",
    "rarity": "rare",
    "effects": [
      {
        "type": "stanceSwitch",
        "times": 1
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "stanceSwitch",
        "times": 1
      },
      {
        "type": "draw",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT49",
    "name": "前压补枪",
    "cost": 1,
    "type": "attack",
    "tag": "stance",
    "rarity": "rare",
    "effects": [
      {
        "type": "stanceSwitch",
        "times": 1
      },
      {
        "type": "attack",
        "n": 6,
        "times": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "stanceSwitch",
        "times": 1
      },
      {
        "type": "attack",
        "n": 9,
        "times": 1
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT50",
    "name": "掩护架点",
    "cost": 1,
    "type": "skill",
    "tag": "stance",
    "rarity": "rare",
    "effects": [
      {
        "type": "stanceSwitch",
        "times": 1
      },
      {
        "type": "block",
        "n": 6
      }
    ],
    "upgradeEffects": [
      {
        "type": "stanceSwitch",
        "times": 1
      },
      {
        "type": "block",
        "n": 9
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT51",
    "name": "姿态回旋",
    "cost": 1,
    "type": "skill",
    "tag": "stance",
    "rarity": "rare",
    "effects": [
      {
        "type": "stanceSwitch",
        "times": 1
      },
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "block",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "stanceSwitch",
        "times": 1
      },
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "block",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT52",
    "name": "瞄准镜",
    "cost": 1,
    "type": "skill",
    "tag": "core",
    "rarity": "rare",
    "effects": [
      {
        "type": "block",
        "n": 4
      },
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "energy",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "block",
        "n": 6
      },
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "energy",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT53",
    "name": "弱点分析",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "rare",
    "effects": [
      {
        "type": "vuln",
        "n": 3,
        "times": 1
      },
      {
        "type": "block",
        "n": 3
      }
    ],
    "upgradeEffects": [
      {
        "type": "vuln",
        "n": 4,
        "times": 1
      },
      {
        "type": "block",
        "n": 5
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT54",
    "name": "战术冲刺",
    "cost": 2,
    "type": "skill",
    "tag": "utility",
    "rarity": "rare",
    "effects": [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "block",
        "n": 4
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 3
      },
      {
        "type": "block",
        "n": 6
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT55",
    "name": "破甲突袭",
    "cost": 2,
    "type": "attack",
    "tag": "damage",
    "rarity": "rare",
    "effects": [
      {
        "type": "attack",
        "n": 8,
        "times": 1
      },
      {
        "type": "vuln",
        "n": 2,
        "times": 1
      },
      {
        "type": "block",
        "n": 4
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 10,
        "times": 1
      },
      {
        "type": "vuln",
        "n": 3,
        "times": 1
      },
      {
        "type": "block",
        "n": 6
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT56",
    "name": "火力全开",
    "cost": 3,
    "type": "attack",
    "tag": "damage",
    "rarity": "rare",
    "effects": [
      {
        "type": "attack",
        "n": 15,
        "times": 1
      },
      {
        "type": "vuln",
        "n": 1,
        "times": 1
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 20,
        "times": 1
      },
      {
        "type": "vuln",
        "n": 2,
        "times": 1
      },
      {
        "type": "draw",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT57",
    "name": "战术统筹",
    "cost": 3,
    "type": "skill",
    "tag": "core",
    "rarity": "rare",
    "effects": [
      {
        "type": "draw",
        "n": 3
      },
      {
        "type": "energy",
        "n": 1
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 4
      },
      {
        "type": "energy",
        "n": 2
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "AM"
  },
  {
    "id": "AMT58",
    "name": "全面强化",
    "cost": 3,
    "type": "skill",
    "tag": "core",
    "rarity": "rare",
    "effects": [
      {
        "type": "upgradeAllInCombatDeck",
        "times": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "upgradeAllInCombatDeck",
        "times": 1
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT59",
    "name": "绝境求生",
    "cost": 2,
    "type": "skill",
    "tag": "response",
    "rarity": "rare",
    "effects": [
      {
        "type": "heal",
        "n": 8
      },
      {
        "type": "block",
        "n": 5
      }
    ],
    "upgradeEffects": [
      {
        "type": "heal",
        "n": 12
      },
      {
        "type": "block",
        "n": 8
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT60",
    "name": "首击突破",
    "cost": 0,
    "type": "attack",
    "tag": "damage",
    "rarity": "rare",
    "effects": [
      {
        "type": "conditional",
        "condition": "first_attack_this_turn",
        "effect": {
          "type": "attack",
          "n": 5,
          "times": 1
        }
      }
    ],
    "upgradeEffects": [
      {
        "type": "conditional",
        "condition": "first_attack_this_turn",
        "effect": {
          "type": "attack",
          "n": 8,
          "times": 1
        }
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT61",
    "name": "后手压制",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "rare",
    "effects": [
      {
        "type": "conditional",
        "condition": "prev_played_attack",
        "effect": {
          "type": "attack",
          "n": 10,
          "times": 1
        }
      },
      {
        "type": "attack",
        "n": 4,
        "times": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "conditional",
        "condition": "prev_played_attack",
        "effect": {
          "type": "attack",
          "n": 14,
          "times": 1
        }
      },
      {
        "type": "attack",
        "n": 6,
        "times": 1
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT62",
    "name": "意图洞察",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "rare",
    "effects": [
      {
        "type": "conditional",
        "condition": "enemy_intends_attack",
        "effect": {
          "type": "attack",
          "n": 10,
          "times": 1
        }
      },
      {
        "type": "attack",
        "n": 4,
        "times": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "conditional",
        "condition": "enemy_intends_attack",
        "effect": {
          "type": "attack",
          "n": 14,
          "times": 1
        }
      },
      {
        "type": "attack",
        "n": 6,
        "times": 1
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT63",
    "name": "烟中寻机",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "rare",
    "effects": [
      {
        "type": "conditional",
        "condition": "enemy_smoke",
        "effect": {
          "type": "attack",
          "n": 12,
          "times": 1
        }
      },
      {
        "type": "attack",
        "n": 4,
        "times": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "conditional",
        "condition": "enemy_smoke",
        "effect": {
          "type": "attack",
          "n": 16,
          "times": 1
        }
      },
      {
        "type": "attack",
        "n": 6,
        "times": 1
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT64",
    "name": "闪光突击",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "rare",
    "effects": [
      {
        "type": "conditional",
        "condition": "enemy_flash",
        "effect": {
          "type": "attack",
          "n": 12,
          "times": 1
        }
      },
      {
        "type": "attack",
        "n": 4,
        "times": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "conditional",
        "condition": "enemy_flash",
        "effect": {
          "type": "attack",
          "n": 16,
          "times": 1
        }
      },
      {
        "type": "attack",
        "n": 6,
        "times": 1
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT65",
    "name": "状态联动",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "rare",
    "effects": [
      {
        "type": "conditional",
        "condition": "enemy_smoke_or_flash",
        "effect": {
          "type": "attack",
          "n": 12,
          "times": 1
        }
      },
      {
        "type": "attack",
        "n": 4,
        "times": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "conditional",
        "condition": "enemy_smoke_or_flash",
        "effect": {
          "type": "attack",
          "n": 16,
          "times": 1
        }
      },
      {
        "type": "attack",
        "n": 6,
        "times": 1
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT66",
    "name": "姿态加成",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "rare",
    "effects": [
      {
        "type": "conditional",
        "condition": "stance_cover",
        "effect": {
          "type": "block",
          "n": 8,
          "times": 1
        }
      },
      {
        "type": "attack",
        "n": 5,
        "times": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "conditional",
        "condition": "stance_cover",
        "effect": {
          "type": "block",
          "n": 12,
          "times": 1
        }
      },
      {
        "type": "attack",
        "n": 7,
        "times": 1
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT67",
    "name": "前压猛攻",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "rare",
    "effects": [
      {
        "type": "conditional",
        "condition": "stance_push",
        "effect": {
          "type": "attack",
          "n": 12,
          "times": 1
        }
      },
      {
        "type": "attack",
        "n": 4,
        "times": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "conditional",
        "condition": "stance_push",
        "effect": {
          "type": "attack",
          "n": 16,
          "times": 1
        }
      },
      {
        "type": "attack",
        "n": 6,
        "times": 1
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT68",
    "name": "应变射击",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "rare",
    "effects": [
      {
        "type": "conditional",
        "condition": "stance_changed_this_turn",
        "effect": {
          "type": "attack",
          "n": 12,
          "times": 1
        }
      },
      {
        "type": "attack",
        "n": 4,
        "times": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "conditional",
        "condition": "stance_changed_this_turn",
        "effect": {
          "type": "attack",
          "n": 16,
          "times": 1
        }
      },
      {
        "type": "attack",
        "n": 6,
        "times": 1
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT69",
    "name": "连续火力",
    "cost": 2,
    "type": "attack",
    "tag": "damage",
    "rarity": "rare",
    "effects": [
      {
        "type": "attack",
        "n": 3,
        "times": 5
      },
      {
        "type": "conditional",
        "condition": "prev_played_attack",
        "effect": {
          "type": "attack",
          "n": 2,
          "times": 1
        }
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 4,
        "times": 5
      },
      {
        "type": "conditional",
        "condition": "prev_played_attack",
        "effect": {
          "type": "attack",
          "n": 3,
          "times": 1
        }
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT70",
    "name": "多重打击",
    "cost": 2,
    "type": "attack",
    "tag": "damage",
    "rarity": "rare",
    "effects": [
      {
        "type": "attack",
        "n": 3,
        "times": 5
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 4,
        "times": 5
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT71",
    "name": "易伤爆发",
    "cost": 2,
    "type": "attack",
    "tag": "damage",
    "rarity": "rare",
    "effects": [
      {
        "type": "attack",
        "n": 8,
        "times": 1
      },
      {
        "type": "vuln",
        "n": 2,
        "times": 1
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 10,
        "times": 1
      },
      {
        "type": "vuln",
        "n": 3,
        "times": 1
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "AM"
  },
  {
    "id": "AMT72",
    "name": "关键突破",
    "cost": 3,
    "type": "attack",
    "tag": "damage",
    "rarity": "rare",
    "effects": [
      {
        "type": "attack",
        "n": 12,
        "times": 1
      },
      {
        "type": "vuln",
        "n": 1,
        "times": 1
      },
      {
        "type": "block",
        "n": 4
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 16,
        "times": 1
      },
      {
        "type": "vuln",
        "n": 2,
        "times": 1
      },
      {
        "type": "block",
        "n": 6
      },
      {
        "type": "draw",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT73",
    "name": "战地包扎",
    "cost": 2,
    "type": "skill",
    "tag": "response",
    "rarity": "rare",
    "effects": [
      {
        "type": "heal",
        "n": 6
      },
      {
        "type": "block",
        "n": 4
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "heal",
        "n": 9
      },
      {
        "type": "block",
        "n": 6
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "AM"
  },
  {
    "id": "AMT74",
    "name": "战术统筹",
    "cost": 1,
    "type": "skill",
    "tag": "core",
    "rarity": "rare",
    "effects": [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "energy",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 3
      },
      {
        "type": "energy",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "AMT75",
    "name": "极限突破",
    "cost": 3,
    "type": "skill",
    "tag": "core",
    "rarity": "rare",
    "effects": [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "energy",
        "n": 2
      },
      {
        "type": "block",
        "n": 5
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 3
      },
      {
        "type": "energy",
        "n": 3
      },
      {
        "type": "block",
        "n": 8
      }
    ],
    "exhaust": false,
    "region": "AM"
  },
  {
    "id": "EMEAT01",
    "name": "烟雾突袭",
    "cost": 0,
    "type": "attack",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "attack",
        "n": 3,
        "times": 1
      },
      {
        "type": "smoke",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 5,
        "times": 1
      },
      {
        "type": "smoke",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT02",
    "name": "闪光压制",
    "cost": 0,
    "type": "attack",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "attack",
        "n": 3,
        "times": 1
      },
      {
        "type": "flash",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 5,
        "times": 1
      },
      {
        "type": "flash",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT03",
    "name": "战术侦查",
    "cost": 0,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "block",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "block",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT04",
    "name": "烟雾诱饵",
    "cost": 0,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "smoke",
        "n": 3
      }
    ],
    "upgradeEffects": [
      {
        "type": "smoke",
        "n": 4
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT05",
    "name": "闪光遮蔽",
    "cost": 0,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "flash",
        "n": 3
      }
    ],
    "upgradeEffects": [
      {
        "type": "flash",
        "n": 4
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT06",
    "name": "战术推进",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "common",
    "effects": [
      {
        "type": "attack",
        "n": 5,
        "times": 1
      },
      {
        "type": "block",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 8,
        "times": 1
      },
      {
        "type": "block",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT07",
    "name": "动线调整",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "block",
        "n": 4
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "block",
        "n": 4
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT08",
    "name": "战场纪要",
    "cost": 0,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "EMEA"
  },
  {
    "id": "EMEAT09",
    "name": "烟闪夹击",
    "cost": 1,
    "type": "attack",
    "tag": "hybrid",
    "rarity": "common",
    "effects": [
      {
        "type": "attack",
        "n": 4,
        "times": 1
      },
      {
        "type": "smoke",
        "n": 1
      },
      {
        "type": "flash",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 6,
        "times": 1
      },
      {
        "type": "smoke",
        "n": 2
      },
      {
        "type": "flash",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT10",
    "name": "临场换弹",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "energy",
        "n": 1
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "energy",
        "n": 1
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "EMEA"
  },
  {
    "id": "EMEAT11",
    "name": "遮蔽烟墙",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "smoke",
        "n": 2
      },
      {
        "type": "block",
        "n": 4
      }
    ],
    "upgradeEffects": [
      {
        "type": "smoke",
        "n": 3
      },
      {
        "type": "block",
        "n": 5
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT12",
    "name": "致盲掩护",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "flash",
        "n": 2
      },
      {
        "type": "block",
        "n": 4
      }
    ],
    "upgradeEffects": [
      {
        "type": "flash",
        "n": 3
      },
      {
        "type": "block",
        "n": 5
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT13",
    "name": "双发点射",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "common",
    "effects": [
      {
        "type": "attack",
        "n": 3,
        "times": 2
      },
      {
        "type": "block",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 4,
        "times": 2
      },
      {
        "type": "block",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT14",
    "name": "沙袋工事",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "block",
        "n": 6
      },
      {
        "type": "stanceSwitch"
      }
    ],
    "upgradeEffects": [
      {
        "type": "block",
        "n": 9
      },
      {
        "type": "stanceSwitch"
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT15",
    "name": "情报整合",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "block",
        "n": 5
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "block",
        "n": 5
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT16",
    "name": "烟中锁定",
    "cost": 1,
    "type": "attack",
    "tag": "hybrid",
    "rarity": "common",
    "effects": [
      {
        "type": "attack",
        "n": 4,
        "times": 1
      },
      {
        "type": "conditional",
        "condition": "enemy_smoke",
        "effect": {
          "type": "attack",
          "n": 4,
          "times": 1
        }
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 6,
        "times": 1
      },
      {
        "type": "conditional",
        "condition": "enemy_smoke",
        "effect": {
          "type": "attack",
          "n": 6,
          "times": 1
        }
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT17",
    "name": "闪光追击",
    "cost": 1,
    "type": "attack",
    "tag": "hybrid",
    "rarity": "common",
    "effects": [
      {
        "type": "attack",
        "n": 4,
        "times": 1
      },
      {
        "type": "conditional",
        "condition": "enemy_flash",
        "effect": {
          "type": "attack",
          "n": 4,
          "times": 1
        }
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 6,
        "times": 1
      },
      {
        "type": "conditional",
        "condition": "enemy_flash",
        "effect": {
          "type": "attack",
          "n": 6,
          "times": 1
        }
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT18",
    "name": "状态清除",
    "cost": 0,
    "type": "skill",
    "tag": "response",
    "rarity": "common",
    "effects": [
      {
        "type": "purgePlayerStatus",
        "id": "weak",
        "n": 1
      },
      {
        "type": "purgePlayerStatus",
        "id": "vuln",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "purgePlayerStatus",
        "id": "weak",
        "n": 2
      },
      {
        "type": "purgePlayerStatus",
        "id": "vuln",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT19",
    "name": "侧身规避",
    "cost": 1,
    "type": "skill",
    "tag": "response",
    "rarity": "common",
    "effects": [
      {
        "type": "block",
        "n": 5
      }
    ],
    "upgradeEffects": [
      {
        "type": "block",
        "n": 8
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT20",
    "name": "能量转换",
    "cost": 0,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "energy",
        "n": 1
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "energy",
        "n": 2
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "EMEA"
  },
  {
    "id": "EMEAT21",
    "name": "战术烟幕",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "smoke",
        "n": 3
      },
      {
        "type": "block",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "smoke",
        "n": 5
      },
      {
        "type": "block",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT22",
    "name": "战术震撼",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "flash",
        "n": 3
      },
      {
        "type": "block",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "flash",
        "n": 5
      },
      {
        "type": "block",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT23",
    "name": "烟雾优势",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "conditional",
        "condition": "enemy_smoke",
        "effect": {
          "type": "attack",
          "n": 12
        }
      },
      {
        "type": "smoke",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "conditional",
        "condition": "enemy_smoke",
        "effect": {
          "type": "attack",
          "n": 16
        }
      },
      {
        "type": "smoke",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT24",
    "name": "闪光优势",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "conditional",
        "condition": "enemy_flash",
        "effect": {
          "type": "attack",
          "n": 12
        }
      },
      {
        "type": "flash",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "conditional",
        "condition": "enemy_flash",
        "effect": {
          "type": "attack",
          "n": 16
        }
      },
      {
        "type": "flash",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT25",
    "name": "远距狙击",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 8,
        "times": 1
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 10,
        "times": 1
      },
      {
        "type": "draw",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT26",
    "name": "弹幕覆盖",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 3,
        "times": 3
      },
      {
        "type": "block",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 4,
        "times": 3
      },
      {
        "type": "block",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT27",
    "name": "破甲弹",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "vuln",
        "n": 2
      },
      {
        "type": "attack",
        "n": 5
      }
    ],
    "upgradeEffects": [
      {
        "type": "vuln",
        "n": 3
      },
      {
        "type": "attack",
        "n": 7
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT28",
    "name": "烟雾治疗",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "heal",
        "n": 4
      },
      {
        "type": "smoke",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "heal",
        "n": 6
      },
      {
        "type": "smoke",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT29",
    "name": "闪光治疗",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "heal",
        "n": 4
      },
      {
        "type": "flash",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "heal",
        "n": 6
      },
      {
        "type": "flash",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT30",
    "name": "战地改装",
    "cost": 0,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "upgradeRandomInHand"
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "upgradeRandomInHand"
      },
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "EMEA"
  },
  {
    "id": "EMEAT31",
    "name": "全面升级",
    "cost": 2,
    "type": "skill",
    "tag": "utility",
    "rarity": "rare",
    "effects": [
      {
        "type": "upgradeAllInHand"
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "upgradeAllInHand"
      },
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "EMEA"
  },
  {
    "id": "EMEAT32",
    "name": "战役准备",
    "cost": 2,
    "type": "skill",
    "tag": "utility",
    "rarity": "rare",
    "effects": [
      {
        "type": "upgradeAllInCombatDeck"
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "upgradeAllInCombatDeck"
      },
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "EMEA"
  },
  {
    "id": "EMEAT33",
    "name": "极限校准",
    "cost": 1,
    "type": "attack",
    "tag": "hybrid",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attackScaledByUpgradedHand",
        "base": 4,
        "per": 3,
        "cap": 4
      }
    ],
    "upgradeEffects": [
      {
        "type": "attackScaledByUpgradedHand",
        "base": 6,
        "per": 3,
        "cap": 4
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT34",
    "name": "烟闪掩护",
    "cost": 1,
    "type": "skill",
    "tag": "stance",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "stanceSwitch"
      },
      {
        "type": "smoke",
        "n": 2
      },
      {
        "type": "block",
        "n": 4
      }
    ],
    "upgradeEffects": [
      {
        "type": "stanceSwitch"
      },
      {
        "type": "smoke",
        "n": 3
      },
      {
        "type": "block",
        "n": 6
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT35",
    "name": "前压突袭",
    "cost": 1,
    "type": "attack",
    "tag": "stance",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "stanceSwitch"
      },
      {
        "type": "attack",
        "n": 6,
        "times": 1
      },
      {
        "type": "vuln",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "stanceSwitch"
      },
      {
        "type": "attack",
        "n": 8,
        "times": 1
      },
      {
        "type": "vuln",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT36",
    "name": "烟中换防",
    "cost": 2,
    "type": "skill",
    "tag": "stance",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "stanceSwitch"
      },
      {
        "type": "smoke",
        "n": 3
      },
      {
        "type": "block",
        "n": 6
      }
    ],
    "upgradeEffects": [
      {
        "type": "stanceSwitch"
      },
      {
        "type": "smoke",
        "n": 4
      },
      {
        "type": "block",
        "n": 8
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT37",
    "name": "闪光突进",
    "cost": 2,
    "type": "attack",
    "tag": "stance",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "stanceSwitch"
      },
      {
        "type": "flash",
        "n": 3
      },
      {
        "type": "attack",
        "n": 6
      }
    ],
    "upgradeEffects": [
      {
        "type": "stanceSwitch"
      },
      {
        "type": "flash",
        "n": 4
      },
      {
        "type": "attack",
        "n": 9
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT38",
    "name": "姿态侦察",
    "cost": 0,
    "type": "skill",
    "tag": "stance",
    "rarity": "common",
    "effects": [
      {
        "type": "stanceSwitch"
      },
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "stanceSwitch"
      },
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "EMEA"
  },
  {
    "id": "EMEAT39",
    "name": "烟雾遮蔽",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "smoke",
        "n": 3
      },
      {
        "type": "block",
        "n": 3
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "smoke",
        "n": 4
      },
      {
        "type": "block",
        "n": 4
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT40",
    "name": "闪光侦查",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "flash",
        "n": 3
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "flash",
        "n": 4
      },
      {
        "type": "draw",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT41",
    "name": "资源回收",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "rare",
    "effects": [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "energy",
        "n": 2
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 3
      },
      {
        "type": "energy",
        "n": 2
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "EMEA"
  },
  {
    "id": "EMEAT42",
    "name": "烟雾净化",
    "cost": 0,
    "type": "skill",
    "tag": "response",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "purgeEnemyStatus",
        "id": "smoke",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "purgeEnemyStatus",
        "id": "smoke",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT43",
    "name": "闪光净化",
    "cost": 0,
    "type": "skill",
    "tag": "response",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "purgeEnemyStatus",
        "id": "flash",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "purgeEnemyStatus",
        "id": "flash",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT44",
    "name": "清除布防",
    "cost": 1,
    "type": "skill",
    "tag": "response",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "purgeEnemyStatus",
        "id": "block",
        "n": 5
      }
    ],
    "upgradeEffects": [
      {
        "type": "purgeEnemyStatus",
        "id": "block",
        "n": 8
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT45",
    "name": "身心净化",
    "cost": 1,
    "type": "skill",
    "tag": "response",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "purgePlayerStatus",
        "id": "weak",
        "n": 99
      },
      {
        "type": "purgePlayerStatus",
        "id": "vuln",
        "n": 99
      },
      {
        "type": "block",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "purgePlayerStatus",
        "id": "weak",
        "n": 99
      },
      {
        "type": "purgePlayerStatus",
        "id": "vuln",
        "n": 99
      },
      {
        "type": "block",
        "n": 4
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT46",
    "name": "紧急整备",
    "cost": 0,
    "type": "skill",
    "tag": "response",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "draw",
        "n": 3
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 4
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "EMEA"
  },
  {
    "id": "EMEAT47",
    "name": "临场充能",
    "cost": 0,
    "type": "skill",
    "tag": "response",
    "rarity": "common",
    "effects": [
      {
        "type": "energy",
        "n": 2
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "energy",
        "n": 3
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "EMEA"
  },
  {
    "id": "EMEAT48",
    "name": "烟幕保护",
    "cost": 2,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "smoke",
        "n": 3
      },
      {
        "type": "block",
        "n": 5
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "smoke",
        "n": 4
      },
      {
        "type": "block",
        "n": 7
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT49",
    "name": "闪光守护",
    "cost": 2,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "flash",
        "n": 3
      },
      {
        "type": "block",
        "n": 5
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "flash",
        "n": 4
      },
      {
        "type": "block",
        "n": 7
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT50",
    "name": "烟闪交织",
    "cost": 2,
    "type": "skill",
    "tag": "utility",
    "rarity": "rare",
    "effects": [
      {
        "type": "smoke",
        "n": 2
      },
      {
        "type": "flash",
        "n": 2
      },
      {
        "type": "draw",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "smoke",
        "n": 3
      },
      {
        "type": "flash",
        "n": 3
      },
      {
        "type": "draw",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT51",
    "name": "烟中突击",
    "cost": 2,
    "type": "attack",
    "tag": "hybrid",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 6
      },
      {
        "type": "conditional",
        "condition": "enemy_smoke",
        "effect": {
          "type": "attack",
          "n": 6
        }
      },
      {
        "type": "smoke",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 8
      },
      {
        "type": "conditional",
        "condition": "enemy_smoke",
        "effect": {
          "type": "attack",
          "n": 8
        }
      },
      {
        "type": "smoke",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT52",
    "name": "闪中突击",
    "cost": 2,
    "type": "attack",
    "tag": "hybrid",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 6
      },
      {
        "type": "conditional",
        "condition": "enemy_flash",
        "effect": {
          "type": "attack",
          "n": 6
        }
      },
      {
        "type": "flash",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 8
      },
      {
        "type": "conditional",
        "condition": "enemy_flash",
        "effect": {
          "type": "attack",
          "n": 8
        }
      },
      {
        "type": "flash",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT53",
    "name": "火焰弹",
    "cost": 2,
    "type": "attack",
    "tag": "damage",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 14
      },
      {
        "type": "weak",
        "n": 1
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 17
      },
      {
        "type": "weak",
        "n": 2
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "EMEA"
  },
  {
    "id": "EMEAT54",
    "name": "重火力",
    "cost": 3,
    "type": "attack",
    "tag": "damage",
    "rarity": "rare",
    "effects": [
      {
        "type": "attack",
        "n": 18
      },
      {
        "type": "weak",
        "n": 2
      },
      {
        "type": "block",
        "n": 5
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 24
      },
      {
        "type": "weak",
        "n": 2
      },
      {
        "type": "block",
        "n": 7
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT55",
    "name": "火力倾泻",
    "cost": 3,
    "type": "attack",
    "tag": "damage",
    "rarity": "rare",
    "effects": [
      {
        "type": "attack",
        "n": 18,
        "times": 1
      },
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "vuln",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 24,
        "times": 1
      },
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "vuln",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT56",
    "name": "统筹调度",
    "cost": 3,
    "type": "skill",
    "tag": "utility",
    "rarity": "rare",
    "effects": [
      {
        "type": "upgradeAllInCombatDeck"
      },
      {
        "type": "block",
        "n": 5
      },
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "upgradeAllInCombatDeck"
      },
      {
        "type": "block",
        "n": 8
      },
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "EMEA"
  },
  {
    "id": "EMEAT57",
    "name": "固守阵地",
    "cost": 3,
    "type": "skill",
    "tag": "response",
    "rarity": "rare",
    "effects": [
      {
        "type": "block",
        "n": 12
      },
      {
        "type": "smoke",
        "n": 2
      },
      {
        "type": "flash",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "block",
        "n": 16
      },
      {
        "type": "smoke",
        "n": 3
      },
      {
        "type": "flash",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT58",
    "name": "经济支援",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "money",
        "n": 20
      }
    ],
    "upgradeEffects": [
      {
        "type": "money",
        "n": 30
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT59",
    "name": "生命强化",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "heal",
        "n": 3
      },
      {
        "type": "heal",
        "n": 3
      }
    ],
    "upgradeEffects": [
      {
        "type": "heal",
        "n": 5
      },
      {
        "type": "heal",
        "n": 5
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT60",
    "name": "快速恢复",
    "cost": 0,
    "type": "skill",
    "tag": "response",
    "rarity": "common",
    "effects": [
      {
        "type": "heal",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "heal",
        "n": 4
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT61",
    "name": "烟中求生",
    "cost": 1,
    "type": "skill",
    "tag": "response",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "block",
        "n": 5
      },
      {
        "type": "conditional",
        "condition": "enemy_smoke",
        "effect": {
          "type": "smoke",
          "n": 2
        }
      }
    ],
    "upgradeEffects": [
      {
        "type": "block",
        "n": 7
      },
      {
        "type": "conditional",
        "condition": "enemy_smoke",
        "effect": {
          "type": "smoke",
          "n": 3
        }
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT62",
    "name": "闪光求生",
    "cost": 1,
    "type": "skill",
    "tag": "response",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "block",
        "n": 5
      },
      {
        "type": "conditional",
        "condition": "enemy_flash",
        "effect": {
          "type": "flash",
          "n": 2
        }
      }
    ],
    "upgradeEffects": [
      {
        "type": "block",
        "n": 7
      },
      {
        "type": "conditional",
        "condition": "enemy_flash",
        "effect": {
          "type": "flash",
          "n": 3
        }
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT63",
    "name": "姿态压制",
    "cost": 1,
    "type": "attack",
    "tag": "stance",
    "rarity": "rare",
    "effects": [
      {
        "type": "attack",
        "n": 8
      },
      {
        "type": "conditional",
        "condition": "stance_changed_this_turn",
        "effect": {
          "type": "attack",
          "n": 6
        }
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 10
      },
      {
        "type": "conditional",
        "condition": "stance_changed_this_turn",
        "effect": {
          "type": "attack",
          "n": 8
        }
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT64",
    "name": "烟闪矩阵",
    "cost": 1,
    "type": "skill",
    "tag": "hybrid",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "smoke",
        "n": 2
      },
      {
        "type": "flash",
        "n": 1
      },
      {
        "type": "block",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "smoke",
        "n": 3
      },
      {
        "type": "flash",
        "n": 2
      },
      {
        "type": "block",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT65",
    "name": "二次校准",
    "cost": 2,
    "type": "attack",
    "tag": "damage",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 5,
        "times": 2
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 7,
        "times": 2
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT66",
    "name": "破坏专家",
    "cost": 2,
    "type": "attack",
    "tag": "damage",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "purgeEnemyStatus",
        "id": "block",
        "n": 10
      },
      {
        "type": "attack",
        "n": 7
      }
    ],
    "upgradeEffects": [
      {
        "type": "purgeEnemyStatus",
        "id": "block",
        "n": 14
      },
      {
        "type": "attack",
        "n": 9
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT67",
    "name": "烟幕掩护",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "smoke",
        "n": 2
      },
      {
        "type": "block",
        "n": 4
      }
    ],
    "upgradeEffects": [
      {
        "type": "smoke",
        "n": 3
      },
      {
        "type": "block",
        "n": 6
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT68",
    "name": "闪光壁垒",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "flash",
        "n": 2
      },
      {
        "type": "block",
        "n": 5
      },
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "flash",
        "n": 3
      },
      {
        "type": "block",
        "n": 7
      },
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "EMEA"
  },
  {
    "id": "EMEAT69",
    "name": "烟闪组合",
    "cost": 1,
    "type": "attack",
    "tag": "hybrid",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 4
      },
      {
        "type": "smoke",
        "n": 1
      },
      {
        "type": "flash",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 6
      },
      {
        "type": "smoke",
        "n": 2
      },
      {
        "type": "flash",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT70",
    "name": "战术补给",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "block",
        "n": 3
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 3
      },
      {
        "type": "block",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT71",
    "name": "应急电源",
    "cost": 0,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "energy",
        "n": 1
      },
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "energy",
        "n": 2
      },
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "EMEA"
  },
  {
    "id": "EMEAT72",
    "name": "烟闪压制",
    "cost": 2,
    "type": "attack",
    "tag": "hybrid",
    "rarity": "rare",
    "effects": [
      {
        "type": "attack",
        "n": 5
      },
      {
        "type": "conditional",
        "condition": "enemy_smoke_or_flash",
        "effect": {
          "type": "attack",
          "n": 10
        }
      },
      {
        "type": "smoke",
        "n": 1
      },
      {
        "type": "flash",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 7
      },
      {
        "type": "conditional",
        "condition": "enemy_smoke_or_flash",
        "effect": {
          "type": "attack",
          "n": 14
        }
      },
      {
        "type": "smoke",
        "n": 2
      },
      {
        "type": "flash",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT73",
    "name": "战术循环",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "energy",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "energy",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT74",
    "name": "烟闪爆发",
    "cost": 3,
    "type": "attack",
    "tag": "hybrid",
    "rarity": "rare",
    "effects": [
      {
        "type": "attack",
        "n": 10
      },
      {
        "type": "conditional",
        "condition": "enemy_smoke_or_flash",
        "effect": {
          "type": "attack",
          "n": 12
        }
      },
      {
        "type": "draw",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 12
      },
      {
        "type": "conditional",
        "condition": "enemy_smoke_or_flash",
        "effect": {
          "type": "attack",
          "n": 16
        }
      },
      {
        "type": "draw",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "EMEAT75",
    "name": "终极调度",
    "cost": 3,
    "type": "skill",
    "tag": "utility",
    "rarity": "rare",
    "effects": [
      {
        "type": "draw",
        "n": 4
      },
      {
        "type": "energy",
        "n": 3
      },
      {
        "type": "block",
        "n": 6
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 5
      },
      {
        "type": "energy",
        "n": 4
      },
      {
        "type": "block",
        "n": 8
      }
    ],
    "exhaust": false,
    "region": "EMEA"
  },
  {
    "id": "PACT01",
    "name": "战术侦察",
    "cost": 0,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT02",
    "name": "战术跃进",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "common",
    "effects": [
      {
        "type": "attack",
        "n": 6,
        "times": 1
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 8,
        "times": 1
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT03",
    "name": "掩护射击",
    "cost": 2,
    "type": "attack",
    "tag": "hybrid",
    "rarity": "common",
    "effects": [
      {
        "type": "attack",
        "n": 5,
        "times": 1
      },
      {
        "type": "block",
        "n": 5
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 6,
        "times": 1
      },
      {
        "type": "block",
        "n": 6
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT04",
    "name": "压制扫射",
    "cost": 2,
    "type": "attack",
    "tag": "damage",
    "rarity": "common",
    "effects": [
      {
        "type": "attack",
        "n": 4,
        "times": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 5,
        "times": 2
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT05",
    "name": "烟幕防护",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "smoke",
        "n": 2
      },
      {
        "type": "block",
        "n": 4
      }
    ],
    "upgradeEffects": [
      {
        "type": "smoke",
        "n": 3
      },
      {
        "type": "block",
        "n": 5
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT06",
    "name": "炫光突袭",
    "cost": 1,
    "type": "attack",
    "tag": "hybrid",
    "rarity": "common",
    "effects": [
      {
        "type": "flash",
        "n": 1
      },
      {
        "type": "attack",
        "n": 4
      }
    ],
    "upgradeEffects": [
      {
        "type": "flash",
        "n": 2
      },
      {
        "type": "attack",
        "n": 6
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT07",
    "name": "弱点标记",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "vuln",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "vuln",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT08",
    "name": "疲惫打击+",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "common",
    "effects": [
      {
        "type": "attack",
        "n": 5
      },
      {
        "type": "weak",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 7
      },
      {
        "type": "weak",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT09",
    "name": "战术翻滚",
    "cost": 0,
    "type": "skill",
    "tag": "response",
    "rarity": "common",
    "effects": [
      {
        "type": "block",
        "n": 4
      }
    ],
    "upgradeEffects": [
      {
        "type": "block",
        "n": 6
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT10",
    "name": "火力校准",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "upgradeRandomInHand"
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 1,
        "times": 1
      },
      {
        "type": "upgradeRandomInHand"
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT11",
    "name": "弹药补充",
    "cost": 0,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "energy",
        "n": 1
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "energy",
        "n": 2
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "PAC"
  },
  {
    "id": "PACT12",
    "name": "战术分析",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "draw",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT13",
    "name": "精确射击",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "common",
    "effects": [
      {
        "type": "attack",
        "n": 8
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 11
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT14",
    "name": "覆盖火力",
    "cost": 2,
    "type": "attack",
    "tag": "damage",
    "rarity": "common",
    "effects": [
      {
        "type": "attack",
        "n": 6
      },
      {
        "type": "weak",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 8
      },
      {
        "type": "weak",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT15",
    "name": "烟雾掩护",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "smoke",
        "n": 3
      }
    ],
    "upgradeEffects": [
      {
        "type": "smoke",
        "n": 4
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT16",
    "name": "致盲区投掷",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "common",
    "effects": [
      {
        "type": "flash",
        "n": 3
      }
    ],
    "upgradeEffects": [
      {
        "type": "flash",
        "n": 4
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT17",
    "name": "战地维修",
    "cost": 1,
    "type": "skill",
    "tag": "response",
    "rarity": "common",
    "effects": [
      {
        "type": "heal",
        "n": 4
      }
    ],
    "upgradeEffects": [
      {
        "type": "heal",
        "n": 7
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT18",
    "name": "破片手雷EX",
    "cost": 2,
    "type": "attack",
    "tag": "damage",
    "rarity": "common",
    "effects": [
      {
        "type": "attack",
        "n": 10
      },
      {
        "type": "vuln",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 13
      },
      {
        "type": "vuln",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT19",
    "name": "战术翻滚+",
    "cost": 1,
    "type": "skill",
    "tag": "response",
    "rarity": "common",
    "effects": [
      {
        "type": "block",
        "n": 5
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "block",
        "n": 7
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT20",
    "name": "侦察射击",
    "cost": 1,
    "type": "attack",
    "tag": "damage",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 6
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 8
      },
      {
        "type": "draw",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT21",
    "name": "破甲射击+",
    "cost": 2,
    "type": "attack",
    "tag": "damage",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 12
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 16
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT22",
    "name": "连珠炮",
    "cost": 2,
    "type": "attack",
    "tag": "damage",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 5,
        "times": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 6,
        "times": 2
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT23",
    "name": "强化烟幕",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "smoke",
        "n": 4
      }
    ],
    "upgradeEffects": [
      {
        "type": "smoke",
        "n": 6
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT24",
    "name": "致盲闪光+",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "flash",
        "n": 4
      }
    ],
    "upgradeEffects": [
      {
        "type": "flash",
        "n": 6
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT25",
    "name": "弱点洞察",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "vuln",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "vuln",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT26",
    "name": "精神压制",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "weak",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "weak",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT27",
    "name": "战术平板",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "block",
        "n": 3
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 3
      },
      {
        "type": "block",
        "n": 4
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT28",
    "name": "区域封锁Ⅱ",
    "cost": 2,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "smoke",
        "n": 5
      },
      {
        "type": "block",
        "n": 5
      }
    ],
    "upgradeEffects": [
      {
        "type": "smoke",
        "n": 7
      },
      {
        "type": "block",
        "n": 7
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT29",
    "name": "诱饵陷阱",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "vuln",
        "n": 2
      },
      {
        "type": "block",
        "n": 4
      }
    ],
    "upgradeEffects": [
      {
        "type": "vuln",
        "n": 3
      },
      {
        "type": "block",
        "n": 6
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT30",
    "name": "信号干扰",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "weak",
        "n": 2
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "weak",
        "n": 3
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT31",
    "name": "烟雾推进",
    "cost": 1,
    "type": "skill",
    "tag": "hybrid",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "smoke",
        "n": 2
      },
      {
        "type": "attack",
        "n": 4
      }
    ],
    "upgradeEffects": [
      {
        "type": "smoke",
        "n": 3
      },
      {
        "type": "attack",
        "n": 6
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT32",
    "name": "战术闪光",
    "cost": 1,
    "type": "skill",
    "tag": "hybrid",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "flash",
        "n": 3
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "flash",
        "n": 4
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT33",
    "name": "烟闪奇袭",
    "cost": 2,
    "type": "attack",
    "tag": "hybrid",
    "rarity": "rare",
    "effects": [
      {
        "type": "conditional",
        "condition": "enemy_smoke_or_flash",
        "effect": {
          "type": "attack",
          "n": 10,
          "times": 1
        }
      },
      {
        "type": "smoke",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "conditional",
        "condition": "enemy_smoke_or_flash",
        "effect": {
          "type": "attack",
          "n": 14,
          "times": 1
        }
      },
      {
        "type": "smoke",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT34",
    "name": "应急侦察",
    "cost": 0,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "block",
        "n": 3
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "block",
        "n": 4
      },
      {
        "type": "draw",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT35",
    "name": "战地回收",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "rare",
    "effects": [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "energy",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 3
      },
      {
        "type": "energy",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT36",
    "name": "致盲闪光",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "weak",
        "n": 2
      },
      {
        "type": "flash",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "weak",
        "n": 3
      },
      {
        "type": "flash",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT37",
    "name": "战术掩护",
    "cost": 1,
    "type": "skill",
    "tag": "stance",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "stanceSwitch"
      },
      {
        "type": "block",
        "n": 6
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "stanceSwitch"
      },
      {
        "type": "block",
        "n": 9
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT38",
    "name": "前压闪击",
    "cost": 1,
    "type": "attack",
    "tag": "stance",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "stanceSwitch"
      },
      {
        "type": "attack",
        "n": 5,
        "times": 1
      },
      {
        "type": "flash",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "stanceSwitch"
      },
      {
        "type": "attack",
        "n": 8,
        "times": 1
      },
      {
        "type": "flash",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT39",
    "name": "烟幕换防",
    "cost": 2,
    "type": "skill",
    "tag": "stance",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "smoke",
        "n": 3
      },
      {
        "type": "stanceSwitch"
      },
      {
        "type": "block",
        "n": 6
      }
    ],
    "upgradeEffects": [
      {
        "type": "smoke",
        "n": 4
      },
      {
        "type": "stanceSwitch"
      },
      {
        "type": "block",
        "n": 8
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT40",
    "name": "闪击换防",
    "cost": 2,
    "type": "attack",
    "tag": "stance",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "flash",
        "n": 2
      },
      {
        "type": "stanceSwitch"
      },
      {
        "type": "attack",
        "n": 5,
        "times": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "flash",
        "n": 3
      },
      {
        "type": "stanceSwitch"
      },
      {
        "type": "attack",
        "n": 8,
        "times": 1
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT41",
    "name": "坚守工事",
    "cost": 1,
    "type": "skill",
    "tag": "stance",
    "rarity": "rare",
    "effects": [
      {
        "type": "block",
        "n": 8
      },
      {
        "type": "conditional",
        "condition": "stance_cover",
        "effect": {
          "type": "block",
          "n": 8
        }
      }
    ],
    "upgradeEffects": [
      {
        "type": "block",
        "n": 11
      },
      {
        "type": "conditional",
        "condition": "stance_cover",
        "effect": {
          "type": "block",
          "n": 11
        }
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT42",
    "name": "破阵突击",
    "cost": 1,
    "type": "attack",
    "tag": "stance",
    "rarity": "rare",
    "effects": [
      {
        "type": "attack",
        "n": 6,
        "times": 1
      },
      {
        "type": "conditional",
        "condition": "stance_push",
        "effect": {
          "type": "attack",
          "n": 8,
          "times": 1
        }
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 8,
        "times": 1
      },
      {
        "type": "conditional",
        "condition": "stance_push",
        "effect": {
          "type": "attack",
          "n": 10,
          "times": 1
        }
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT43",
    "name": "姿态调度",
    "cost": 0,
    "type": "skill",
    "tag": "stance",
    "rarity": "common",
    "effects": [
      {
        "type": "stanceSwitch"
      }
    ],
    "upgradeEffects": [
      {
        "type": "stanceSwitch"
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT44",
    "name": "战术协调",
    "cost": 1,
    "type": "skill",
    "tag": "stance",
    "rarity": "rare",
    "effects": [
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "stanceSwitch"
      },
      {
        "type": "block",
        "n": 5
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "stanceSwitch"
      },
      {
        "type": "block",
        "n": 7
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT45",
    "name": "烟中奇袭",
    "cost": 1,
    "type": "attack",
    "tag": "hybrid",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 4,
        "times": 1
      },
      {
        "type": "conditional",
        "condition": "enemy_smoke",
        "effect": {
          "type": "attack",
          "n": 8,
          "times": 1
        }
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 5,
        "times": 1
      },
      {
        "type": "conditional",
        "condition": "enemy_smoke",
        "effect": {
          "type": "attack",
          "n": 10,
          "times": 1
        }
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT46",
    "name": "闪中奇袭",
    "cost": 1,
    "type": "attack",
    "tag": "hybrid",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 4,
        "times": 1
      },
      {
        "type": "conditional",
        "condition": "enemy_flash",
        "effect": {
          "type": "attack",
          "n": 8,
          "times": 1
        }
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 5,
        "times": 1
      },
      {
        "type": "conditional",
        "condition": "enemy_flash",
        "effect": {
          "type": "attack",
          "n": 10,
          "times": 1
        }
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT47",
    "name": "战术反击",
    "cost": 1,
    "type": "attack",
    "tag": "hybrid",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 7,
        "times": 1
      },
      {
        "type": "conditional",
        "condition": "prev_played_attack",
        "effect": {
          "type": "block",
          "n": 3
        }
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 9,
        "times": 1
      },
      {
        "type": "conditional",
        "condition": "prev_played_attack",
        "effect": {
          "type": "block",
          "n": 5
        }
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT48",
    "name": "急速点射",
    "cost": 0,
    "type": "attack",
    "tag": "hybrid",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 3,
        "times": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 3,
        "times": 1
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT49",
    "name": "机动换防",
    "cost": 1,
    "type": "skill",
    "tag": "hybrid",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "block",
        "n": 4
      },
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "stanceSwitch"
      }
    ],
    "upgradeEffects": [
      {
        "type": "block",
        "n": 6
      },
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "stanceSwitch"
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT50",
    "name": "攻守兼备",
    "cost": 2,
    "type": "attack",
    "tag": "hybrid",
    "rarity": "rare",
    "effects": [
      {
        "type": "attack",
        "n": 8,
        "times": 1
      },
      {
        "type": "block",
        "n": 5
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 11,
        "times": 1
      },
      {
        "type": "block",
        "n": 7
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT51",
    "name": "烟闪干扰",
    "cost": 1,
    "type": "skill",
    "tag": "hybrid",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "smoke",
        "n": 2
      },
      {
        "type": "flash",
        "n": 2
      },
      {
        "type": "block",
        "n": 3
      }
    ],
    "upgradeEffects": [
      {
        "type": "smoke",
        "n": 3
      },
      {
        "type": "flash",
        "n": 3
      },
      {
        "type": "block",
        "n": 4
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT52",
    "name": "战术补枪",
    "cost": 1,
    "type": "attack",
    "tag": "hybrid",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 9
      },
      {
        "type": "conditional",
        "condition": "stance_changed_this_turn",
        "effect": {
          "type": "attack",
          "n": 5
        }
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 11
      },
      {
        "type": "conditional",
        "condition": "stance_changed_this_turn",
        "effect": {
          "type": "attack",
          "n": 7
        }
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT53",
    "name": "战术整合",
    "cost": 1,
    "type": "skill",
    "tag": "response",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "heal",
        "n": 7
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "heal",
        "n": 10
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT54",
    "name": "净化弱化",
    "cost": 0,
    "type": "skill",
    "tag": "response",
    "rarity": "common",
    "effects": [
      {
        "type": "purgePlayerStatus",
        "id": "weak",
        "n": 2
      },
      {
        "type": "block",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "purgePlayerStatus",
        "id": "weak",
        "n": 2
      },
      {
        "type": "block",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT55",
    "name": "坚定意志",
    "cost": 0,
    "type": "skill",
    "tag": "response",
    "rarity": "common",
    "effects": [
      {
        "type": "purgePlayerStatus",
        "id": "vuln",
        "n": 2
      },
      {
        "type": "block",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "purgePlayerStatus",
        "id": "vuln",
        "n": 2
      },
      {
        "type": "block",
        "n": 3
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT56",
    "name": "全面净化",
    "cost": 1,
    "type": "skill",
    "tag": "response",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "purgePlayerStatus",
        "id": "weak",
        "n": 99
      },
      {
        "type": "purgePlayerStatus",
        "id": "vuln",
        "n": 99
      },
      {
        "type": "block",
        "n": 3
      }
    ],
    "upgradeEffects": [
      {
        "type": "purgePlayerStatus",
        "id": "weak",
        "n": 99
      },
      {
        "type": "purgePlayerStatus",
        "id": "vuln",
        "n": 99
      },
      {
        "type": "block",
        "n": 5
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT57",
    "name": "破防闪光弹",
    "cost": 1,
    "type": "skill",
    "tag": "response",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "purgeEnemyStatus",
        "id": "block",
        "n": 99
      },
      {
        "type": "flash",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "purgeEnemyStatus",
        "id": "block",
        "n": 99
      },
      {
        "type": "flash",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT58",
    "name": "紧急调度令",
    "cost": 0,
    "type": "skill",
    "tag": "response",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "draw",
        "n": 3
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 4
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "PAC"
  },
  {
    "id": "PACT59",
    "name": "临时能量",
    "cost": 0,
    "type": "skill",
    "tag": "response",
    "rarity": "common",
    "effects": [
      {
        "type": "energy",
        "n": 2
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "energy",
        "n": 3
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "PAC"
  },
  {
    "id": "PACT60",
    "name": "战术笔记升级",
    "cost": 1,
    "type": "skill",
    "tag": "response",
    "rarity": "common",
    "effects": [
      {
        "type": "block",
        "n": 5
      },
      {
        "type": "upgradeRandomInHand"
      }
    ],
    "upgradeEffects": [
      {
        "type": "block",
        "n": 5
      },
      {
        "type": "upgradeAllInHand"
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT61",
    "name": "集体复盘行动",
    "cost": 1,
    "type": "skill",
    "tag": "response",
    "rarity": "rare",
    "effects": [
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "block",
        "n": 5
      },
      {
        "type": "upgradeAllInHand"
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "block",
        "n": 5
      },
      {
        "type": "upgradeAllInHand"
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "PAC"
  },
  {
    "id": "PACT62",
    "name": "赛前战略统筹",
    "cost": 2,
    "type": "skill",
    "tag": "core",
    "rarity": "rare",
    "effects": [
      {
        "type": "upgradeAllInCombatDeck"
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "upgradeAllInCombatDeck"
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "PAC"
  },
  {
    "id": "PACT63",
    "name": "临场升级",
    "cost": 0,
    "type": "skill",
    "tag": "response",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "upgradeRandomInHand"
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "upgradeRandomInHand"
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "PAC"
  },
  {
    "id": "PACT64",
    "name": "烟中回看战术",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "conditional",
        "condition": "enemy_smoke",
        "effect": {
          "type": "upgradeRandomInHand"
        }
      },
      {
        "type": "smoke",
        "n": 3
      },
      {
        "type": "block",
        "n": 3
      }
    ],
    "upgradeEffects": [
      {
        "type": "conditional",
        "condition": "enemy_smoke",
        "effect": {
          "type": "upgradeRandomInHand"
        }
      },
      {
        "type": "smoke",
        "n": 4
      },
      {
        "type": "block",
        "n": 4
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT65",
    "name": "精练攻势强化",
    "cost": 1,
    "type": "attack",
    "tag": "hybrid",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attackScaledByUpgradedHand",
        "base": 6,
        "per": 2,
        "cap": 4
      }
    ],
    "upgradeEffects": [
      {
        "type": "attackScaledByUpgradedHand",
        "base": 8,
        "per": 2,
        "cap": 4
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT66",
    "name": "连夜复盘行动",
    "cost": 1,
    "type": "skill",
    "tag": "response",
    "rarity": "rare",
    "effects": [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "upgradeRandomInHand"
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 3
      },
      {
        "type": "upgradeRandomInHand"
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "PAC"
  },
  {
    "id": "PACT67",
    "name": "长期防御工事",
    "cost": 3,
    "type": "skill",
    "tag": "response",
    "rarity": "rare",
    "effects": [
      {
        "type": "block",
        "n": 18
      },
      {
        "type": "upgradeAllInCombatDeck"
      }
    ],
    "upgradeEffects": [
      {
        "type": "block",
        "n": 24
      },
      {
        "type": "upgradeAllInCombatDeck"
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT68",
    "name": "火力训练升级",
    "cost": 1,
    "type": "attack",
    "tag": "hybrid",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "attack",
        "n": 8
      },
      {
        "type": "upgradeRandomInHand"
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 10
      },
      {
        "type": "upgradeAllInHand"
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT69",
    "name": "架点训练强化",
    "cost": 1,
    "type": "skill",
    "tag": "response",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "block",
        "n": 6
      },
      {
        "type": "upgradeRandomInHand"
      }
    ],
    "upgradeEffects": [
      {
        "type": "block",
        "n": 8
      },
      {
        "type": "upgradeAllInHand"
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT70",
    "name": "消耗复盘战术",
    "cost": 2,
    "type": "skill",
    "tag": "core",
    "rarity": "rare",
    "effects": [
      {
        "type": "draw",
        "n": 1
      },
      {
        "type": "upgradeAllInHand"
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "upgradeAllInHand"
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "PAC"
  },
  {
    "id": "PACT71",
    "name": "调度演练",
    "cost": 1,
    "type": "skill",
    "tag": "response",
    "rarity": "common",
    "effects": [
      {
        "type": "draw",
        "n": 2
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "draw",
        "n": 3
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "PAC"
  },
  {
    "id": "PACT72",
    "name": "能量回收",
    "cost": 1,
    "type": "skill",
    "tag": "utility",
    "rarity": "uncommon",
    "effects": [
      {
        "type": "energy",
        "n": 1
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "upgradeEffects": [
      {
        "type": "energy",
        "n": 2
      },
      {
        "type": "draw",
        "n": 1
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT73",
    "name": "极限压榨",
    "cost": 3,
    "type": "skill",
    "tag": "core",
    "rarity": "rare",
    "effects": [
      {
        "type": "energy",
        "n": 3
      },
      {
        "type": "draw",
        "n": 4
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "energy",
        "n": 4
      },
      {
        "type": "draw",
        "n": 5
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "PAC"
  },
  {
    "id": "PACT74",
    "name": "倾泻火力",
    "cost": 3,
    "type": "attack",
    "tag": "damage",
    "rarity": "rare",
    "effects": [
      {
        "type": "attack",
        "n": 6,
        "times": 3
      },
      {
        "type": "draw",
        "n": 2
      }
    ],
    "upgradeEffects": [
      {
        "type": "attack",
        "n": 7,
        "times": 3
      },
      {
        "type": "draw",
        "n": 2
      }
    ],
    "exhaust": false,
    "region": "PAC"
  },
  {
    "id": "PACT75",
    "name": "决胜动员",
    "cost": 3,
    "type": "skill",
    "tag": "core",
    "rarity": "rare",
    "effects": [
      {
        "type": "upgradeAllInCombatDeck"
      },
      {
        "type": "energy",
        "n": 2
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "upgradeEffects": [
      {
        "type": "upgradeAllInCombatDeck"
      },
      {
        "type": "energy",
        "n": 3
      },
      {
        "type": "exhaustSelf"
      }
    ],
    "exhaust": true,
    "region": "PAC"
  }
];
