# 《杀戮尖塔》一代全卡机制索引与 FPS 战术转写初稿

> 本索引是设计研究，不是可直接照搬的数值表。原卡英文描述没有转载；“机制简述”和“战术转写”由 DeepSeek 初筛，主代理核对了记录数量、结构、抽样卡与关键锚点。其余逐张文字仍需在实现前以原始数据和游戏内行为复核。

数据源：[Spire Archive 的 STS1 cards.json](https://github.com/nkhoit/spire-archive/blob/687e6dce1f325234425e1b75f09d13ddd6ce7000/data/sts1/cards.json)，2026-09-09 版本。此第三方数据共 360 条，包含可获得牌、初始牌、生成牌、状态与诅咒。内部 ID 与牌面英文名不同是常见情况，不应直接认定为数据错误。部分记录确有缺字、升级标志不完整等问题，见下文。

费用栏的箭头表示升级后变费；X 是投入剩余能量；“不可打出”是状态或诅咒，不是负费用。基础数字只列数据字段中的伤害/格挡和升级增量，不能替代完整效果。

## 铁甲战士（75 条）

| 原卡 | 类型/稀有度 | 费用 | 基础数值 | 原机制简述 | 升级与数值（初筛） | 战术转写方向 | 采用 |
|---|---|---:|---|---|---|---|---|
| Anger `ANGER` | Attack/Common | 0 | 伤6(+2) | 0费打6，使用后往弃牌堆加入一张复制 | 保留费用0，伤害6；升级后伤害8。费用与数值不变，仅将'弃牌堆复制'改为战术资源循环。 | 战术名：近战连击（Melee Combo）。效果：0费，对目标造成6点伤害，并将本卡的一张复制置入弃牌堆。灵感源于持续近战压制。 | adapt |
| Armaments `ARMAMENTS` | Skill/Common | 1 | 防5 | 1费获得5格挡，并升级本回合手牌中的一张卡 | 保留费用1，格挡5；升级后效果变为升级所有手牌（而非一张）。 | 战术名：装备整备（Gear Prep）。效果：1费，获得5点布防，本回合内你手牌中的一张技能或攻击牌临时升级（本场战斗）。 | adapt |
| Barricade `BARRICADE` | Power/Rare | 3→2 | — | 3费能力：格挡值不再回合开始时清零 | 费用3，升级后2。效果与费用不变，仅将'格挡'替换为'布防'。 | 战术名：永久工事（Permanent Fortification）。效果：3费能力，本场战斗你未消耗的布防值可保留至下回合。 | direct |
| Bash `BASH` | Attack/Basic | 2 | 伤8(+2) | 2费打8，施加2层易伤 | 保留费用2，伤害8，易伤2；升级后伤害10，易伤3。 | 战术名：破片手雷（Frag Grenade）。效果：2费，造成8点伤害并施加2层易伤。 | direct |
| Battle Trance `BATTLE_TRANCE` | Skill/Uncommon | 0 | — | 0费抽3，本回合无法再抽牌 | 费用0，抽3；升级后抽4。 | 战术名：专注瞄准（Focus Aim）。效果：0费，抽3张牌，本回合不能再抽牌。 | direct |
| Berserk `BERSERK` | Power/Rare | 0 | — | 0费能力：获得2层易伤（负面），每回合开始获得1点能量 | 保留费用0，易伤2；升级后易伤1。能量获得不变（原作中[R]相当于1点费用）。 | 战术名：嗜血狂暴（Bloodlust）。效果：0费能力，获得2层易伤，但每回合开始额外获得1点战术能量。 | adapt |
| Bloodletting `BLOODLETTING` | Skill/Uncommon | 0 | — | 0费失去3HP，获得2点能量 | 保留费用0，能量2；升级后能量3。原作失去HP改为消耗护甲或生命，数值一致。 | 战术名：紧急供能（Emergency Power）。效果：0费，消耗3点护甲或生命值（若存在），获得2点战术能量。 | adapt |
| Blood for Blood `BLOOD_FOR_BLOOD` | Attack/Uncommon | 4→3 | 伤18(+4) | 费用4但每失去一次HP减1费，造成18伤害 | 原作基础费用4高于本项目上限，但符合X费动态，保留数值；升级后费用3，伤害22。 | 战术名：复仇打击（Vengeance Strike）。效果：费用初始4，但每次你失去护甲或生命值（受击或自损）时本卡费用减1（最低0），造成18点伤害。 | adapt |
| Bludgeon `BLUDGEON` | Attack/Rare | 3 | 伤32(+10) | 3费打32 | 费用3，伤害32；升级后伤害42。 | 战术名：重锤突袭（Sledgehammer）。效果：3费，造成32点大量伤害。 | direct |
| Body Slam `BODY_SLAM` | Attack/Common | 1→0 | 伤0 | 1费造成等于当前格挡的伤害 | 原作伤害标记为0但实际动态；升级后费用0但伤害机制不变。 | 战术名：盾击（Shield Bash）。效果：1费，造成等于你当前布防值的伤害。 | direct |
| Brutality `BRUTALITY` | Power/Rare | 0 | — | 0费能力：每回合开始失去1HP并抽1 | 费用0；升级后获得固有（Innate）属性，即开局必入手牌。 | 战术名：破釜沉舟（Desperate Measure）。效果：0费能力，每回合开始失去1点护甲或生命，抽1张牌。 | adapt |
| Burning Pact `BURNING_PACT` | Skill/Uncommon | 1 | — | 1费消耗1张牌并抽2 | 费用1，消耗1抽2；升级后抽3。 | 战术名：战场取舍（Field Sacrifice）。效果：1费，消耗你的一张手牌，然后抽2张牌。 | direct |
| Carnage `CARNAGE` | Attack/Uncommon | 2 | 伤20(+8) | 2费打20，虚幻（回合结束若仍在手则消耗） | 费用2，伤害20；升级后伤害28。虚幻机制保留。 | 战术名：一次性火箭筒（Disposable RPG）。效果：2费，造成20点伤害，本回合若未打出则消耗。 | direct |
| Clash `CLASH` | Attack/Common | 0 | 伤14(+4) | 0费打14，但仅当手牌全是攻击牌时才能打出 | 费用0，伤害14；升级后伤害18。条件保留。 | 战术名：纯突击协议（Pure Assault Protocol）。效果：0费，若你手牌中没有技能/能力牌，则造成14点伤害。 | adapt |
| Cleave `CLEAVE` | Attack/Common | 1 | 伤8(+3) | 1费对所有敌人打8 | 费用1，伤害8；升级后伤害11。 | 战术名：破片手雷（AoE）。效果：1费，对所有敌人造成8点伤害。 | direct |
| Clothesline `CLOTHESLINE` | Attack/Common | 2 | 伤12(+2) | 2费打12并施加2虚弱 | 费用2，伤害12，压制2；升级后伤害14，压制3。 | 战术名：战术擒拿（Tactical Takedown）。效果：2费，造成12点伤害并施加2层压制（虚弱）。 | direct |
| Combust `COMBUST` | Power/Uncommon | 1 | — | 1费能力：回合结束失去1HP并对所有敌人造成5伤害 | 费用1；升级后伤害变为7。 | 战术名：燃烧弹幕（Incendiary Barrage）。效果：1费能力，每回合结束牺牲1点护甲或生命，对所有敌人造成5点伤害。 | adapt |
| Corruption `CORRUPTION` | Power/Rare | 3→2 | — | 3费能力：所有技能牌费用变为0，但打出后消耗 | 费用3，升级后2。 | 战术名：过载协议（Overload Protocol）。效果：3费能力，本场战斗中你的所有技能牌费用为0，但打出后直接消耗。 | direct |
| Dark Embrace `DARK_EMBRACE` | Power/Uncommon | 2→1 | — | 2费能力：每当有卡被消耗时抽1 | 费用2，升级后1。 | 战术名：影子回收（Shadow Recycling）。效果：2费能力，每当一张牌被消耗时抽1张牌。 | direct |
| Defend `DEFEND_R` | Skill/Basic | 1 | 防5(+3) | 1费获得5格挡 | 费用1，格挡5；升级后8。 | 战术名：基础防御（Basic Defense）。效果：1费，获得5点布防。 | direct |
| Demon Form `DEMON_FORM` | Power/Rare | 3 | — | 3费能力：每回合开始获得2力量 | 费用3；升级后力量获得变为3。 | 战术名：杀戮本能（Killing Instinct）。效果：3费能力，每回合开始你的攻击伤害+2（即力量等效）。 | adapt |
| Disarm `DISARM` | Skill/Uncommon | 1 | — | 1费敌人失去2力量，消耗 | 费用1，力量减少2；升级后减少3。 | 战术名：电子干扰（Electronic Jamming）。效果：1费，使一名敌人攻击下降2（力量减少），消耗。 | direct |
| Double Tap `DOUBLE_TAP` | Skill/Rare | 1 | — | 1费：本回合你的下一次攻击打出两次 | 费用1；升级后变为下两张攻击牌生效两次。 | 战术名：双发扳机（Double Trigger）。效果：1费，本回合你的下一张攻击牌生效两次。 | direct |
| Dropkick `DROPKICK` | Attack/Uncommon | 1 | 伤5(+3) | 1费打5，若敌人有易伤则获得能量并抽1 | 费用1，伤害5；升级后伤害8。 | 战术名：弱点追击（Weakness Exploit）。效果：1费，造成5点伤害，若目标有易伤则获得1点战术能量并抽1张牌。 | direct |
| Dual Wield `DUAL_WIELD` | Skill/Uncommon | 1 | — | 1费选择一张攻击或能力牌，加入一张复制到手牌 | 费用1；升级后加入两张复制。 | 战术名：武器复制（Weapon Replicate）。效果：1费，选择一张攻击或能力牌，将一张复制置入手牌。 | direct |
| Entrench `ENTRENCH` | Skill/Uncommon | 2→1 | — | 2费使当前格挡翻倍 | 费用2；升级后费用1。 | 战术名：加固阵地（Reinforce Position）。效果：2费，使你的当前布防值翻倍。 | direct |
| Evolve `EVOLVE` | Power/Uncommon | 1 | — | 1费能力：每当你抽到状态牌时抽1 | 费用1；升级后额外抽2张。 | 战术名：适应战术（Adaptive Tactics）。效果：1费能力，每当抽到负面状态牌时额外抽1张。 | direct |
| Exhume `EXHUME` | Skill/Rare | 1→0 | — | 1费从消耗堆拿一张牌到手牌，消耗 | 费用1；升级后费用0。 | 战术名：装备回收（Equipment Reclaim）。效果：1费，从已消耗的牌中选择一张加入手牌，本卡消耗。 | direct |
| Feed `FEED` | Attack/Rare | 1 | 伤10(+2) | 1费打10，若杀死敌人则最大生命+3，消耗 | 费用1，伤害10；升级后伤害12，生命上限+4。 | 战术名：战地补给（Field Ration）。效果：1费，造成10点伤害，若以此杀死敌人，你的最大生命值上限+3，消耗。 | adapt |
| Feel No Pain `FEEL_NO_PAIN` | Power/Uncommon | 1 | — | 1费能力：每当有卡被消耗时获得3格挡 | 费用1；升级后获得4点布防。 | 战术名：止损协议（Damage Control）。效果：1费能力，每当一张牌被消耗时获得3点布防。 | direct |
| Fiend Fire `FIEND_FIRE` | Attack/Rare | 2 | 伤7(+3) | 2费消耗所有手牌，每消耗一张造成7伤害，消耗 | 费用2，每张伤害7；升级后每张伤害10。 | 战术名：孤注一掷（All or Nothing）。效果：2费，消耗你所有手牌，每消耗一张对随机敌人（或多个）造成7点伤害，本卡消耗。 | direct |
| Fire Breathing `FIRE_BREATHING` | Power/Uncommon | 1 | — | 1费能力：每抽到状态或诅咒牌时对所有敌人造成6伤害 | 费用1，伤害6；升级后伤害10。 | 战术名：燃烧反应（Inferno Response）。效果：1费能力，每当抽到状态牌时对所有敌人造成6点伤害。 | direct |
| Flame Barrier `FLAME_BARRIER` | Skill/Uncommon | 2 | 防12(+4) | 2费获得12格挡，本回合受攻击时反弹4伤害 | 费用2，格挡12，反弹4；升级后格挡16，反弹6。 | 战术名：反应装甲（Reactive Armor）。效果：2费，获得12点布防，本回合每次受到攻击时对攻击者造成4点伤害。 | direct |
| Flex `FLEX` | Skill/Common | 0 | — | 0费获得2力量，回合结束失去2力量 | 费用0，力量2；升级后力量4但回合结束仍失去2（净+2）。 | 战术名：肾上腺素（Adrenaline Spike）。效果：0费，本回合获得+2攻击伤害，回合结束移除该加成。 | adapt |
| Ghostly Armor `GHOSTLY_ARMOR` | Skill/Uncommon | 1 | 防10(+3) | 1费获得10格挡，虚幻 | 费用1，格挡10；升级后格挡13。 | 战术名：临时护盾（Temporary Shield）。效果：1费，获得10点布防，本卡为虚幻（若回合结束未打出则消耗）。 | direct |
| Havoc `HAVOC` | Skill/Common | 1→0 | — | 1费打出牌库顶的牌并消耗它 | 费用1；升级后费用0。 | 战术名：紧急开火（Emergency Fire）。效果：1费，将牌库顶的一张牌立即打出并消耗。 | direct |
| Headbutt `HEADBUTT` | Attack/Common | 1 | 伤9(+3) | 1费打9，将弃牌堆一张牌放到牌库顶 | 费用1，伤害9；升级后伤害12。 | 战术名：位移射击（Displacement Shot）。效果：1费，造成9点伤害，然后从弃牌堆选择一张牌放到牌库顶。 | direct |
| Heavy Blade `HEAVY_BLADE` | Attack/Common | 2 | 伤14 | 2费打14，力量加成3次 | 费用2，伤害14，加成3次；升级后加成5次。 | 战术名：穿甲重击（Armor Piercing）。效果：2费，造成14点伤害，攻击加成效果（如力量）额外生效3次。 | direct |
| Hemokinesis `HEMOKINESIS` | Attack/Uncommon | 1 | 伤15(+5) | 1费失去2HP打15 | 费用1，失血2，伤害15；升级后伤害20。 | 战术名：血弹（Blood Bullet）。效果：1费，消耗2点生命，造成15点伤害。 | adapt |
| Immolate `IMMOLATE` | Attack/Rare | 2 | 伤21(+7) | 2费对所有敌人打21，往弃牌堆加一张灼烧状态 | 费用2，伤害21；升级后伤害28。 | 战术名：燃烧弹轰炸（Napalm Strike）。效果：2费，对所有敌人造成21点伤害，并将一张'灼烧'状态牌置入弃牌堆。 | direct |
| Impervious `IMPERVIOUS` | Skill/Rare | 2 | 防30(+10) | 2费获得30格挡，消耗 | 费用2，格挡30；升级后格挡40。 | 战术名：全效护盾（Total Shield）。效果：2费，获得30点布防，消耗。 | direct |
| Infernal Blade `INFERNAL_BLADE` | Skill/Uncommon | 1→0 | — | 1费随机 добавить Attack到手牌，本回合0费，消耗 | 费用1；升级后费用0。 | 战术名：武器快拔（Quick Draw）。效果：1费，随机将一张攻击牌加入手牌，令其本回合费用为0，本卡消耗。 | direct |
| Inflame `INFLAME` | Power/Uncommon | 1 | — | 1费能力：获得2力量 | 费用1，力量2；升级后力量3。 | 战术名：强化训练（Enhanced Training）。效果：1费能力，本场战斗你的攻击伤害+2。 | adapt |
| Intimidate `INTIMIDATE` | Skill/Uncommon | 0 | — | 0费对所有敌人施加1虚弱，消耗 | 费用0，压制1；升级后压制2。 | 战术名：战术威慑（Tactical Suppression）。效果：0费，对所有敌人施加1层压制（虚弱），消耗。 | direct |
| Iron Wave `IRON_WAVE` | Attack/Common | 1 | 伤5(+2)、防5(+2) | 1费获得5格挡并打5 | 费用1，格挡5，伤害5；升级后两者均提升2（格挡7伤害7）。 | 战术名：攻防一体（Offense-Defense）。效果：1费，获得5点布防并造成5点伤害。 | direct |
| Juggernaut `JUGGERNAUT` | Power/Rare | 2 | — | 2费能力：每当获得格挡时对随机敌人造成5伤害 | 费用2，伤害5；升级后伤害7。 | 战术名：重装突击（Juggernaut Assault）。效果：2费能力，每当获得布防时对一个随机敌人造成5点伤害。 | direct |
| Limit Break `LIMIT_BREAK` | Skill/Rare | 1 | — | 1费使力量翻倍，消耗 | 费用1；升级后不再消耗（可重复使用）。 | 战术名：极限突破（Limit Break）。效果：1费，使你的攻击加成（力量）翻倍，消耗。 | direct |
| Metallicize `METALLICIZE` | Power/Uncommon | 1 | — | 1费能力：回合结束获得3格挡 | 费用1，格挡3；升级后格挡4。 | 战术名：自动装甲（Auto-Plate）。效果：1费能力，每回合结束自动获得3点布防。 | direct |
| Offering `OFFERING` | Skill/Rare | 0 | — | 0费失去6HP，获得2能量并抽3，消耗 | 费用0，失血6，能量2，抽3；升级后抽5。 | 战术名：献祭协议（Sacrifice Pact）。效果：0费，失去6点生命，获得2点战术能量并抽3张牌，消耗。 | adapt |
| Perfected Strike `PERFECTED_STRIKE` | Attack/Common | 2 | 伤6 | 2费打6，每有一张含'打击'的牌伤害+2 | 费用2，基础伤害6，额外+2；升级后额外+3。 | 战术名：战术协同射击（Synergy Shot）。效果：2费，造成6点伤害，你卡组中每有一张带有'射击'字样的牌，此伤害额外+2。 | adapt |
| Pommel Strike `POMMEL_STRIKE` | Attack/Common | 1 | 伤9(+1) | 1费打9并抽1 | 费用1，伤害9；升级后伤害10，抽2张。 | 战术名：枪托打击（Rifle Butt）。效果：1费，造成9点伤害并抽1张牌。 | direct |
| Power Through `POWER_THROUGH` | Skill/Uncommon | 1 | 防15(+5) | 1费获得15格挡，但手牌加入2张伤口 | 费用1，格挡15；升级后格挡20。 | 战术名：强行突破（Force Through）。效果：1费，获得15点布防，并将2张'伤口'状态牌置入手牌。 | direct |
| Pummel `PUMMEL` | Attack/Uncommon | 1 | 伤2 | 1费造成2伤害4次，消耗 | 费用1，总伤害8；升级后变为5次（总伤10）。 | 战术名：快速连射（Rapid Fire）。效果：1费，造成2点伤害4次（可分散或集中），消耗。 | direct |
| Rage `RAGE` | Skill/Uncommon | 0 | — | 0费：本回合每打出一张攻击牌获得3格挡 | 费用0，格挡3；升级后格挡5。 | 战术名：战斗亢奋（Combat Rush）。效果：0费，本回合每当你打出一张攻击牌，获得3点布防。 | direct |
| Rampage `RAMPAGE` | Attack/Uncommon | 1 | 伤8 | 1费打8，本场战斗每次使用后伤害+5 | 费用1，基础伤害8，成长+5；升级后成长+8。 | 战术名：越战越勇（Escalating Assault）。效果：1费，造成8点伤害，每次使用后本卡本场战斗伤害+5。 | direct |
| Reaper `REAPER` | Attack/Rare | 2 | 伤4(+1) | 2费对所有敌人打4，恢复等于未格挡伤害的生命，消耗 | 费用2，伤害4；升级后伤害5。 | 战术名：生命汲取（Life Drain）。效果：2费，对所有敌人造成4点伤害，回复等同于实际造成伤害的生命值，消耗。 | direct |
| Reckless Charge `RECKLESS_CHARGE` | Attack/Uncommon | 0 | 伤7(+3) | 0费打7，往抽牌堆洗入一张晕眩 | 费用0，伤害7；升级后伤害10。 | 战术名：鲁莽冲锋（Reckless Rush）。效果：0费，造成7点伤害，并将一张'晕眩'状态牌洗入你的牌库。 | direct |
| Rupture `RUPTURE` | Power/Uncommon | 1 | — | 1费能力：每当因卡牌失去HP时获得1力量 | 费用1；升级后获得2层加成。 | 战术名：破伤风（Wound Exploit）。效果：1费能力，每当因你的卡牌效果失去生命值时，获得1层攻击加成。 | direct |
| Searing Blow `SEARING_BLOW` | Attack/Uncommon | 2 | 伤12 | 2费打12，可被升级任意次数 | 费用2，伤害12；升级通常为伤害提升但输入未给出具体增量，需按原作每次+4左右设计。 | 战术名：定制枪械（Customized Weapon）。效果：2费，造成12点伤害，本卡可以多次升级（每次升级伤害提升）。 | direct |
| Second Wind `SECOND_WIND` | Skill/Uncommon | 1 | 防5(+2) | 1费消耗所有非攻击牌，每消耗一张获得5格挡 | 费用1，每张格挡5；升级后每张格挡7。 | 战术名：紧急清理（Emergency Purge）。效果：1费，消耗你手中所有非攻击牌，每消耗一张获得5点布防。 | direct |
| Seeing Red `SEEING_RED` | Skill/Uncommon | 1→0 | — | 1费获得2能量，消耗 | 费用1；升级后费用0。 | 战术名：红色预警（Red Alert）。效果：1费，获得2点战术能量，消耗。 | direct |
| Sentinel `SENTINEL` | Skill/Uncommon | 1 | 防5(+3) | 1费获得5格挡，若被消耗则获得2能量 | 费用1，格挡5；升级后格挡8，被消耗时能量3。 | 战术名：警戒哨兵（Vigilant Sentinel）。效果：1费，获得5点布防，若本卡被消耗则获得2点战术能量。 | direct |
| Sever Soul `SEVER_SOUL` | Attack/Uncommon | 2 | 伤16(+6) | 2费消耗所有非攻击牌，造成16伤害 | 费用2，伤害16；升级后伤害22。 | 战术名：灵魂切割（Soul Cut）。效果：2费，消耗你手中所有非攻击牌，然后造成16点伤害。 | direct |
| Shockwave `SHOCKWAVE` | Skill/Uncommon | 2 | — | 2费对所有敌人施加3虚弱和3易伤，消耗 | 费用2，数值3/3；升级后数值5/5。 | 战术名：震荡波（Shockwave）。效果：2费，对所有敌人施加3层压制和3层易伤，消耗。 | direct |
| Shrug It Off `SHRUG_IT_OFF` | Skill/Common | 1 | 防8(+3) | 1费获得8格挡并抽1 | 费用1，格挡8；升级后格挡11。 | 战术名：从容应对（Shrug Off）。效果：1费，获得8点布防并抽1张牌。 | direct |
| Spot Weakness `SPOT_WEAKNESS` | Skill/Uncommon | 1 | — | 1费若敌人意图攻击则获得3力量 | 费用1，力量3；升级后力量4。 | 战术名：发现破绽（Spot Weakness）。效果：1费，若目标敌人本回合意图攻击你，则获得3点攻击加成。 | direct |
| Strike `STRIKE_R` | Attack/Basic | 1 | 伤6(+3) | 1费打6 | 费用1，伤害6；升级后伤害9。 | 战术名：基础射击（Basic Shot）。效果：1费，造成6点伤害。 | direct |
| Sword Boomerang `SWORD_BOOMERANG` | Attack/Common | 1 | 伤3 | 1费对随机敌人造成3点伤害3次 | 费用1，每段伤害3，次数3；升级后每段伤害4。 | 战术名：回旋飞刃（Boomerang Blade）。效果：1费，对随机敌人造成3点伤害3次。 | direct |
| Thunderclap `THUNDERCLAP` | Attack/Common | 1 | 伤4(+3) | 1费对所有敌人打4并施加1易伤 | 费用1，伤害4，易伤1；升级后伤害7。 | 战术名：震爆弹（Concussion Grenade）。效果：1费，对所有敌人造成4点伤害并施加1层易伤。 | direct |
| True Grit `TRUE_GRIT` | Skill/Common | 1 | 防7(+2) | 1费获得7格挡，随机消耗一张手牌 | 费用1，格挡7；升级后格挡9，且可指定要消耗的牌（而非随机）。 | 战术名：断尾求生（Steely Resolve）。效果：1费，获得7点布防，随机消耗一张手牌。 | direct |
| Twin Strike `TWIN_STRIKE` | Attack/Common | 1 | 伤5(+2) | 1费造成5点伤害2次 | 费用1，伤害5x2；升级后伤害7x2。 | 战术名：双击（Double Tap）。效果：1费，造成5点伤害2次。 | direct |
| Uppercut `UPPERCUT` | Attack/Uncommon | 2 | 伤13 | 2费打13，施加1虚弱和1易伤 | 费用2，伤害13，压制1，易伤1；升级后压制变为2，其余不变。 | 战术名：上勾拳（Uppercut）。效果：2费，造成13点伤害，施加1层压制和1层易伤。 | direct |
| Warcry `WARCRY` | Skill/Common | 0 | — | 0费抽1，将手牌一张放到牌库顶，消耗 | 费用0；升级后抽2张。 | 战术名：战术呼号（Battle Cry）。效果：0费，抽1张牌，然后将一张手牌放到牌库顶，消耗。 | direct |
| Whirlwind `WHIRLWIND` | Attack/Uncommon | X | 伤5(+3) | X费：对所有敌人造成5点伤害X次 | 原作费用标记为-1（实为X），本方案需定义X费用机制；每点费用对应一次5伤害，升级后每次伤害8。 | 战术名：旋风扫射（Cyclone Sweep）。效果：费用X（任意数量），对所有敌人造成5点伤害X次。 | adapt |
| Wild Strike `WILD_STRIKE` | Attack/Common | 1 | 伤12(+5) | 1费打12，往牌库洗入一张伤口 | 费用1，伤害12；升级后伤害17。 | 战术名：莽撞射击（Wild Shot）。效果：1费，造成12点伤害，并将一张'伤口'状态牌洗入你的牌库。 | direct |

## 静默猎手（75 条）

| 原卡 | 类型/稀有度 | 费用 | 基础数值 | 原机制简述 | 升级与数值（初筛） | 战术转写方向 | 采用 |
|---|---|---:|---|---|---|---|---|
| Accuracy `ACCURACY` | Power/Uncommon | 1 | — | 能力：小刀额外造成4点伤害 | 1费；升级后小刀伤害+2（4→6） | 精确校准：小刀/轻型投掷武器伤害+4 | adapt |
| Acrobatics `ACROBATICS` | Skill/Common | 1 | — | 抽3弃1 | 1费；升级后抽4弃1 | 战术翻腾：抽3弃1 | adapt |
| Adrenaline `ADRENALINE` | Skill/Rare | 0 | — | 获得1能量，抽2，消耗 | 0费；升级后+2能量，抽2，消耗 | 肾上腺素：+1能量，抽2，消耗 | direct |
| After Image `AFTER_IMAGE` | Power/Rare | 1 | — | 每打出一张牌获得1格挡 | 1费；升级后固有，效果不变 | 残影护盾：每打出一张牌+1布防 | adapt |
| All-Out Attack `ALL_OUT_ATTACK` | Attack/Uncommon | 1 | 伤10(+4) | 对所有敌人造成10伤害，随机弃1 | 1费；升级后伤害+4（10→14） | 全弹扫射：对所有敌人10伤害，随机弃1 | adapt |
| A Thousand Cuts `A_THOUSAND_CUTS` | Power/Rare | 2 | — | 每打出一张牌对所有敌人造成1伤害 | 2费；升级后伤害+1（1→2） | 千刀万剐：每打出牌对全体1伤害 | adapt |
| Backflip `BACKFLIP` | Skill/Common | 1 | 防5(+3) | 获得5格挡，抽2 | 1费；升级后布防+3（5→8） | 后空翻：+5布防，抽2 | adapt |
| Backstab `BACKSTAB` | Attack/Uncommon | 0 | 伤11(+4) | 固有，造成11伤害，消耗 | 0费；升级后伤害+4（11→15） | 背刺：固有，11伤害，消耗 | direct |
| Bane `BANE` | Attack/Common | 1 | 伤7(+3) | 造成7伤害，若敌人中毒再造成7 | 1费；升级后首段伤害+3（7→10），第二段仍7 | 毒刃：7伤害，若目标中毒再+7 | adapt |
| Blade Dance `BLADE_DANCE` | Skill/Common | 1 | — | 添加3把小刀到手牌 | 1费；升级后+1把小刀（3→4） | 剑刃之舞：生成3把小刀 | adapt |
| Blur `BLUR` | Skill/Uncommon | 1 | 防5(+3) | 获得5格挡，格挡不消失 | 1费；升级后布防+3（5→8） | 战术模糊：+5布防，本回合不消退 | adapt |
| Bouncing Flask `BOUNCING_FLASK` | Skill/Uncommon | 2 | — | 对随机敌人施加3毒3次 | 2费；升级后每次+1毒（3→4） | 弹跳毒瓶：随机敌人3毒×3 | adapt |
| Bullet Time `BULLET_TIME` | Skill/Rare | 3→2 | — | 本回合不能抽牌，手牌费用归零 | 3费；升级后费用降至2 | 子弹时间：本回合不再抽牌，手牌费用0 | adapt |
| Burst `BURST` | Skill/Rare | 1 | — | 本回合下一次技能打出两次 | 1费；升级后影响下2个技能 | 爆发：本回合下个技能双重施放 | adapt |
| Calculated Gamble `CALCULATED_GAMBLE` | Skill/Uncommon | 0 | — | 弃掉手牌并抽等量，消耗 | 0费；升级后移除消耗 | 孤注一掷：弃掉手牌抽等量，消耗 | adapt |
| Caltrops `CALTROPS` | Power/Uncommon | 1 | — | 受到攻击时反弹3伤害 | 1费；升级后反伤+2（3→5） | 铁蒺藜：被攻击时反伤3 | adapt |
| Catalyst `CATALYST` | Skill/Uncommon | 1 | — | 敌人中毒翻倍，消耗 | 1费；升级后中毒三倍 | 催化剂：目标中毒翻倍，消耗 | direct |
| Choke `CHOKE` | Attack/Uncommon | 2 | 伤12 | 造成12伤害，本回合每打出一张牌敌人失去3HP | 2费；升级后额外掉血+2（3→5） | 窒息：12伤害，本回合每出牌目标额外掉3HP | adapt |
| Cloak and Dagger `CLOAK_AND_DAGGER` | Skill/Common | 1 | 防6 | 获得6格挡，添加1把小刀 | 1费；升级后小刀+1（1→2） | 斗篷与飞刀：+6布防，生成1把小刀 | adapt |
| Concentrate `CONCENTRATE` | Skill/Uncommon | 0 | — | 弃3牌获得2能量 | 0费；升级后弃2牌+2能量 | 专注：弃3牌+2能量 | adapt |
| Corpse Explosion `CORPSE_EXPLOSION` | Skill/Rare | 2 | — | 施加6毒，敌人死亡时对全体造成其最大生命伤害 | 2费；升级后毒+3（6→9） | 尸体爆炸：施6毒，死亡时对全体造成其最大HP伤害 | adapt |
| Crippling Cloud `CRIPPLING_POISON` | Skill/Uncommon | 2 | — | 对所有敌人施加4毒和2弱，消耗 | 2费；升级后毒+3（4→7），压制仍2 | 致残毒云：全体4毒+2压制，消耗 | adapt |
| Dagger Spray `DAGGER_SPRAY` | Attack/Common | 1 | 伤4(+2) | 对所有敌人造成4伤害两次 | 1费；升级后每次伤害+2（4→6） | 匕首散射：全体4伤害×2 | adapt |
| Dagger Throw `DAGGER_THROW` | Attack/Common | 1 | 伤9(+3) | 造成9伤害，抽1弃1 | 1费；升级后伤害+3（9→12） | 飞刀投掷：9伤害，抽1弃1 | adapt |
| Dash `DASH` | Attack/Uncommon | 2 | 伤10(+3)、防10(+3) | 获得10格挡并造成10伤害 | 2费；升级后布防和伤害均+3（10→13） | 冲刺：+10布防，10伤害 | direct |
| Deadly Poison `DEADLY_POISON` | Skill/Common | 1 | — | 施加5毒 | 1费；升级后毒+2（5→7） | 致命毒药：施5毒 | adapt |
| Defend `DEFEND_G` | Skill/Basic | 1 | 防5(+3) | 获得5格挡 | 1费；升级后布防+3（5→8） | 防御：+5布防 | direct |
| Deflect `DEFLECT` | Skill/Common | 0 | 防4(+3) | 获得4格挡 | 0费；升级后布防+3（4→7） | 偏折：+4布防 | direct |
| Die Die Die `DIE_DIE_DIE` | Attack/Rare | 1 | 伤13(+4) | 对所有敌人造成13伤害，消耗 | 1费；升级后伤害+4（13→17） | 死吧死吧：全体13伤害，消耗 | adapt |
| Distraction `DISTRACTION` | Skill/Uncommon | 1→0 | — | 添加随机技能到手牌，本回合0费，消耗 | 1费；升级后费用0 | 干扰：随机技能本回合0费，消耗 | adapt |
| Dodge and Roll `DODGE_AND_ROLL` | Skill/Common | 1 | 防4(+2) | 获得4格挡，下回合获得4格挡 | 1费；升级后当回合布防+2（4→6），下回合同4 | 闪避翻滚：+4布防，下回合+4布防 | adapt |
| Doppelganger `DOPPELGANGER` | Skill/Rare | X | — | 下回合抽X牌并获得X能量，消耗 | X费（输入为-1）；升级后X+1 | 分身：下回合抽X并+X能量，消耗 | defer |
| Endless Agony `ENDLESS_AGONY` | Attack/Uncommon | 0 | 伤4(+2) | 造成4伤害，抽到时复制一张到手中，消耗 | 0费；升级后伤害+2（4→6） | 无尽痛苦：4伤害，抽到时自我复制，消耗 | adapt |
| Envenom `ENVENOM` | Power/Rare | 2→1 | — | 攻击造成未格挡伤害时施加1毒 | 2费；升级后费用降至1 | 淬毒：攻击造成实际伤害时+1毒 | adapt |
| Escape Plan `ESCAPE_PLAN` | Skill/Uncommon | 0 | 防3(+2) | 抽1，若抽到技能获得3格挡 | 0费；升级后布防+2（3→5） | 逃脱计划：抽1，若为技能+3布防 | adapt |
| Eviscerate `EVISCERATE` | Attack/Uncommon | 3 | 伤7(+2) | 本回合每弃一张牌费用-1，造成7伤害3次 | 3费；升级后每次伤害+2（7→9） | 剖腹：弃牌减费，7伤害×3 | adapt |
| Expertise `EXPERTISE` | Skill/Uncommon | 1 | — | 抽牌直到手牌6张 | 1费；升级后抽至7张 | 专精：抽至手牌6张 | adapt |
| Finisher `FINISHER` | Attack/Uncommon | 1 | 伤6(+2) | 本回合每打出一张攻击造成6伤害 | 1费；升级后基础伤害+2（6→8） | 终结技：每张已打攻击+6伤害 | adapt |
| Flechettes `FLECHETTES` | Attack/Uncommon | 1 | 伤4(+2) | 手中每张技能造成4伤害 | 1费；升级后伤害+2（4→6） | 飞刺：手中每张技能4伤害 | adapt |
| Flying Knee `FLYING_KNEE` | Attack/Common | 1 | 伤8(+3) | 造成8伤害，下回合获得1能量 | 1费；升级后伤害+3（8→11） | 飞膝：8伤害，下回合+1能量 | adapt |
| Footwork `FOOTWORK` | Power/Uncommon | 1 | — | 获得2敏捷 | 1费；升级后+3敏捷 | 步法：+2敏捷（提升布防） | direct |
| Glass Knife `GLASS_KNIFE` | Attack/Rare | 1 | 伤8(+4) | 造成8伤害两次，每次使用伤害-2 | 1费；升级后初伤+4（8→12） | 玻璃刀：8伤害×2，使用后伤害减2 | adapt |
| Grand Finale `GRAND_FINALE` | Attack/Rare | 0 | 伤50(+10) | 抽牌堆为空才能打，对全体50伤害 | 0费；升级后伤害+10（50→60） | 华丽终场：抽牌堆空时全体50伤害 | adapt |
| Heel Hook `HEEL_HOOK` | Attack/Uncommon | 1 | 伤5(+3) | 造成5伤害，若敌人弱则获得1能量并抽1 | 1费；升级后伤害+3（5→8） | 脚跟钩：5伤害，目标弱时+1能量抽1 | adapt |
| Infinite Blades `INFINITE_BLADES` | Power/Uncommon | 1 | — | 每回合开始添加一把小刀 | 1费；升级后固有 | 无限刀锋：每回合开始生成小刀 | adapt |
| Leg Sweep `LEG_SWEEP` | Skill/Uncommon | 2 | 防11(+3) | 施加2弱，获得11格挡 | 2费；升级后压制+1，布防+3（11→14） | 扫堂腿：施2压制，+11布防 | adapt |
| Malaise `MALAISE` | Skill/Rare | X | — | 敌人失去X力量，施加X弱，消耗 | X费（输入为-1）；升级后X+1 | 萎靡：目标降X攻击，施X压制，消耗 | defer |
| Masterful Stab `MASTERFUL_STAB` | Attack/Uncommon | 0 | 伤12(+4) | 每受一次伤害费用+1，造成12伤害 | 0费但受伤加费；升级后伤害+4（12→16） | 精准刺击：受伤越多越贵，12伤害 | adapt |
| Neutralize `NEUTRALIZE` | Attack/Basic | 0 | 伤3(+1) | 造成3伤害，施加1弱 | 0费；升级后伤害+1（3→4），压制+1（1→2） | 中和：3伤害，施1压制 | direct |
| Nightmare `NIGHT_TERROR` | Skill/Rare | 3→2 | — | 选择一张牌，下回合添加3张复制，消耗 | 3费；升级后费用2 | 梦魇：选择牌，下回合+3复制，消耗 | adapt |
| Noxious Fumes `NOXIOUS_FUMES` | Power/Uncommon | 1 | — | 每回合开始对全体敌人施加2毒 | 1费；升级后毒+1（2→3） | 毒雾：每回合开始全体2毒 | adapt |
| Outmaneuver `OUTMANEUVER` | Skill/Common | 1 | — | 下回合获得2能量 | 1费；升级后+3能量 | 机动：下回合+2能量 | direct |
| Phantasmal Killer `PHANTASMAL_KILLER` | Skill/Rare | 1→0 | — | 下回合攻击伤害翻倍 | 1费；升级后费用0 | 幻影杀手：下回合攻击伤害翻倍 | adapt |
| Piercing Wail `PIERCINGWAIL` | Skill/Common | 1 | — | 所有敌人失去6力量本回合，消耗 | 1费；升级后-8攻击 | 穿刺哀嚎：本回合敌人-6攻击，消耗 | adapt |
| Poisoned Stab `POISONED_STAB` | Attack/Common | 1 | 伤6(+2) | 造成6伤害，施加3毒 | 1费；升级后伤害+2（6→8），毒+1（3→4） | 淬毒刺击：6伤害，施3毒 | adapt |
| Predator `PREDATOR` | Attack/Uncommon | 2 | 伤15(+5) | 造成15伤害，下回合抽2额外牌 | 2费；升级后伤害+5（15→20） | 掠食者：15伤害，下回合+2抽牌 | adapt |
| Prepared `PREPARED` | Skill/Common | 0 | — | 抽1弃1 | 0费；升级后抽2弃2 | 预备：抽1弃1 | direct |
| Quick Slash `QUICK_SLASH` | Attack/Common | 1 | 伤8(+4) | 造成8伤害，抽1 | 1费；升级后伤害+4（8→12） | 快速斩击：8伤害，抽1 | adapt |
| Reflex `REFLEX` | Skill/Uncommon | 不可打出 | — | 不可打，从手中丢弃时抽2 | 不可打（输入为-2）；升级后弃掉时抽3 | 反射：不可打，被弃时抽2 | defer |
| Riddle with Holes `RIDDLE_WITH_HOLES` | Attack/Uncommon | 2 | 伤3(+1) | 造成3伤害5次 | 2费；升级后每次伤害+1（3→4） | 千疮百孔：3伤害×5 | adapt |
| Setup `SETUP` | Skill/Uncommon | 1→0 | — | 将一张手牌放牌堆顶，该牌费用0直到打出 | 1费；升级后费用0 | 布置：置顶手牌并使其0费 | adapt |
| Skewer `SKEWER` | Attack/Uncommon | X | 伤7(+3) | 造成7伤害X次 | X费（输入为-1）；升级后每次伤害+3（7→10） | 穿心：7伤害×X | defer |
| Slice `SLICE` | Attack/Common | 0 | 伤6(+3) | 造成6伤害 | 0费；升级后伤害+3（6→9） | 切割：6伤害 | direct |
| Storm of Steel `STORM_OF_STEEL` | Skill/Rare | 1 | — | 弃掉手牌，每弃一张添加一把小刀 | 1费；升级后生成小刀+ | 钢铁风暴：弃牌生成小刀 | adapt |
| Strike `STRIKE_G` | Attack/Basic | 1 | 伤6(+3) | 造成6伤害 | 1费；升级后伤害+3（6→9） | 打击：6伤害 | direct |
| Sucker Punch `SUCKER_PUNCH` | Attack/Common | 1 | 伤7(+2) | 造成7伤害，施加1弱 | 1费；升级后伤害+2（7→9），压制+1（1→2） | 偷袭：7伤害，施1压制 | adapt |
| Survivor `SURVIVOR` | Skill/Basic | 1 | 防8(+3) | 获得8格挡，弃1 | 1费；升级后布防+3（8→11） | 幸存者：+8布防，弃1 | direct |
| Tactician `TACTICIAN` | Skill/Uncommon | 不可打出 | — | 不可打，从手中丢弃时获得1能量 | 不可打（输入为-2）；升级后弃掉时+2能量 | 战术家：不可打，被弃时+1能量 | defer |
| Terror `TERROR` | Skill/Uncommon | 1→0 | — | 施加99易伤，消耗 | 1费；升级后费用0 | 恐惧：施99易伤，消耗 | adapt |
| Tools of the Trade `TOOLS_OF_THE_TRADE` | Power/Rare | 1→0 | — | 每回合开始抽1弃1 | 1费；升级后费用0 | 交易工具：每回合开始抽1弃1 | adapt |
| Sneaky Strike `UNDERHANDED_STRIKE` | Attack/Common | 2 | 伤12(+4) | 造成12伤害，若本回合弃过牌获得2能量 | 2费；升级后伤害+4（12→16） | 暗手打击：12伤害，若弃过牌+2能量 | adapt |
| Unload `UNLOAD` | Attack/Rare | 1 | 伤14(+4) | 造成14伤害，弃掉所有非攻击牌 | 1费；升级后伤害+4（14→18） | 卸弹：14伤害，弃掉所有非攻击牌 | adapt |
| Alchemize `VENOMOLOGY` | Skill/Rare | 1→0 | — | 获得随机药水，消耗 | 1费；升级后费用0 | 炼金术：获得随机战术道具，消耗 | defer |
| Well-Laid Plans `WELL_LAID_PLANS` | Power/Uncommon | 1 | — | 每回合结束保留最多1张牌 | 1费；升级后保留2张 | 周密计划：每回合结束保留1张牌 | adapt |
| Wraith Form `WRAITH_FORM_V2` | Power/Rare | 3 | — | 获得2无形，每回合结束失去1敏捷 | 3费；升级后无形+1（2→3） | 幽灵形态：获得2无形（免伤），每回合结束-1敏捷 | adapt |

## 故障机器人（76 条）

| 原卡 | 类型/稀有度 | 费用 | 基础数值 | 原机制简述 | 升级与数值（初筛） | 战术转写方向 | 采用 |
|---|---|---:|---|---|---|---|---|
| Aggregate `AGGREGATE` | Skill/Uncommon | 1 | — | 根据抽牌堆每4张获得1点能量，升级后每3张。 | 费用1，升级阈值4->3 | 战术蓄能：根据牌库剩余数量获得能量点，1费。 | adapt |
| All for One `ALL_FOR_ONE` | Attack/Rare | 2 | 伤10(+4) | 造成10伤害，将所有0费卡从弃牌堆返回手牌。升级伤害14。 | 费用2，伤害10/14 | 全数回收：2费范围攻击并回收所有0费战术道具。 | adapt |
| Amplify `AMPLIFY` | Skill/Rare | 1 | — | 本回合下一次能力牌触发两次。升级后两次。 | 费用1，升级多触发一次 | 增幅器：1费，下一张能力牌生效两次。 | adapt |
| Auto-Shields `AUTO_SHIELDS` | Skill/Uncommon | 1 | 防11(+4) | 如果无布防获得11布防，升级15。 | 费用1，布防11/15 | 应急护盾：1费，若本回合无防御则获得布防。 | direct |
| Ball Lightning `BALL_LIGHTNING` | Attack/Common | 1 | 伤7(+3) | 造成7伤害并生成一个闪电球。升级伤害10。 | 费用1，伤害7/10，部署1电击 | 电击手雷：1费，造成伤害并部署一个电击装置。 | adapt |
| Barrage `BARRAGE` | Attack/Common | 1 | 伤4(+2) | 每个充能球造成4伤害，升级6。 | 费用1，每个装置伤害4/6 | 火力覆盖：根据已部署战术装置数量造成多次伤害，1费。 | adapt |
| Beam Cell `BEAM_CELL` | Attack/Common | 0 | 伤3(+1) | 造成3伤害并施加1易伤，升级4伤害2易伤。 | 费用0，伤害3/4，易伤1/2 | 激光标记：0费，小额伤害并施加易伤。 | direct |
| Biased Cognition `BIASED_COGNITION` | Power/Rare | 1 | — | 获得4专注，每回合减1，升级5。 | 费用1，专注4/5，每回合-1 | 超频认知：1费能力，立即提升全局效果但每回合衰减。 | adapt |
| Blizzard `BLIZZARD` | Attack/Uncommon | 1 | 伤0 | 所有敌人受到2倍战场冰霜数量的伤害，升级3倍。 | 费用1，倍率2/3 | 冰暴：1费，根据本场施加的压制层数造成范围伤害。 | adapt |
| Boot Sequence `BOOTSEQUENCE` | Skill/Uncommon | 0 | 防10(+3) | 固有，获得10布防并消耗，升级13。 | 费用0，布防10/13，消耗 | 开场护甲：0费，固有，获得布防后消耗。 | direct |
| Buffer `BUFFER` | Power/Rare | 2 | — | 防止下一次生命损失，升级两次。 | 费用2，次数1/2 | 缓冲护盾：2费能力，完全抵挡下一次伤害。 | direct |
| Capacitor `CAPACITOR` | Power/Uncommon | 1 | — | 获得2个球槽，升级3。 | 费用1，槽位+2/+3 | 扩展插槽：1费能力，增加可部署战术装置上限。 | adapt |
| Chaos `CHAOS` | Skill/Uncommon | 1 | — | 生成1个随机球体，升级2个。 | 费用1，随机装置1/2 | 随机部署：1费，部署一个随机战术装置。 | adapt |
| Chill `CHILL` | Skill/Uncommon | 0 | — | 每个敌人产生1冰霜，消耗，升级固有。 | 费用0，每敌1层，消耗 | 烟雾封路：0费，对每个敌人施加1层压制，消耗。 | adapt |
| Cold Snap `COLD_SNAP` | Attack/Common | 1 | 伤6(+3) | 造成6伤害并产生冰霜，升级9。 | 费用1，伤害6/9，减速1层 | 冰冻弹：1费，伤害并施加压制/减速。 | adapt |
| Compile Driver `COMPILE_DRIVER` | Attack/Common | 1 | 伤7(+3) | 造成7伤害，每种独特球体抽1卡，升级10。 | 费用1，伤害7/10，抽牌=装置种类数 | 数据编译：1费，根据已部署的不同装置种类抽牌。 | adapt |
| Charge Battery `CONSERVE_BATTERY` | Skill/Common | 1 | 防7(+3) | 获得7布防，下回合获得能量，升级10布防。 | 费用1，布防7/10，下回合+1能量 | 节能护盾：1费，获得布防并蓄能至下回合。 | direct |
| Consume `CONSUME` | Skill/Uncommon | 2 | — | 获得2专注，失去1球槽，升级3专注。 | 费用2，专注2/3，槽位-1 | 牺牲槽位：2费，降低装置上限以提升全局效果。 | adapt |
| Coolheaded `COOLHEADED` | Skill/Common | 1 | — | 产生冰霜并抽1卡，升级抽2。 | 费用1，压制1层，抽牌1/2 | 冷静射击：1费，施加压制并抽牌。 | adapt |
| Core Surge `CORE_SURGE` | Attack/Rare | 1 | 伤11(+4) | 造成11伤害，获得1层人工制品，消耗，升级15。 | 费用1，伤害11/15，免疫1层 | 核心冲击：1费，伤害并清除负面状态，消耗。 | adapt |
| Creative AI `CREATIVE_AI` | Power/Rare | 3→2 | — | 每回合开始添加随机能力牌，升级费用2。 | 费用3，升级后2 | 战术AI：3费/2费，每回合生成随机能力卡。 | adapt |
| Darkness `DARKNESS` | Skill/Uncommon | 1 | — | 生成1个黑暗球，升级额外触发其被动。 | 费用1，生成1暗影，升级触发被动 | 暗影部署：1费，布设延迟伤害陷阱。 | adapt |
| Defend `DEFEND_B` | Skill/Basic | 1 | 防5(+3) | 获得5布防，升级8。 | 费用1，布防5/8 | 基础防御：1费，获得5/8布防。 | direct |
| Defragment `DEFRAGMENT` | Power/Uncommon | 1 | — | 获得1专注，升级2。 | 费用1，专注1/2 | 系统优化：1费能力，全局战术效能+1/+2。 | direct |
| Doom and Gloom `DOOM_AND_GLOOM` | Attack/Uncommon | 2 | 伤10(+4) | 所有敌人受到10伤害，并生成黑暗球，升级14。 | 费用2，伤害10/14，生成1暗影 | 毁灭轰击：2费，范围伤害并布设暗影装置。 | adapt |
| Double Energy `DOUBLE_ENERGY` | Skill/Uncommon | 1→0 | — | 能量翻倍，消耗，升级0费。 | 费用1，升级0 | 能量超载：1费/0费，当前能量翻倍，消耗。 | direct |
| Dualcast `DUALCAST` | Skill/Basic | 1→0 | — | 下一个球体触发两次，升级0费。 | 费用1，升级0 | 双重激活：1费/0费，下一个战术装置被动触发两次。 | adapt |
| Echo Form `ECHO_FORM` | Power/Rare | 3 | — | 虚无，每回合第一张牌打出两次，升级移除虚无。 | 费用3，升级移除虚无 | 回响：3费能力，每回合首张战术卡生效两次。 | direct |
| Electrodynamics `ELECTRODYNAMICS` | Power/Rare | 2 | — | 闪电球对所有敌人，生成2个闪电，升级3。 | 费用2，生成2/3 | 电磁扩散：2费，所有电击装置范围化，并部署2/3个。 | adapt |
| Fission `FISSION` | Skill/Rare | 0 | — | 移除所有球体，每个获得能量和抽1卡，消耗，升级改为激发。 | 费用0，每装置能量+抽1，消耗 | 紧急释放：0费，报废所有战术装置换取能量和抽牌。 | adapt |
| Force Field `FORCE_FIELD` | Skill/Uncommon | 4 | 防12(+4) | 4费，根据本场能力牌减少费用，获得12布防，升级16。 | 原作4费，布防12/16，减费机制 | 能力力场：初始3费，每使用一张能力牌减1费，获得布防。 | adapt |
| FTL `FTL` | Attack/Uncommon | 0 | 伤5(+1) | 造成5伤害，若本回合出牌少于3张抽1卡，升级6伤害且少于4张。 | 费用0，伤害5/6，阈值3/4 | 快速突袭：0费，低出牌数时抽牌。 | direct |
| Fusion `FUSION` | Skill/Uncommon | 2→1 | — | 生成1个等离子球，升级费用1。 | 费用2，升级1 | 等离子电池：2费/1费，部署能量生成装置。 | adapt |
| Claw `GASH` | Attack/Common | 0 | 伤3(+2) | 造成3伤害，本场所有爪击伤害+2，升级5。 | 费用0，伤害3/5，成长+2 | 刺刀连击：0费，使用后提升后续同卡伤害。 | direct |
| Genetic Algorithm `GENETIC_ALGORITHM` | Skill/Uncommon | 1 | — | 获得布防（基础值缺失），永久提升本卡布防2，消耗，升级3。 | 费用1，成长+2/+3，消耗；基础值异常 | 自适应护甲：1费，可成长布防卡，消耗。 | adapt |
| Glacier `GLACIER` | Skill/Uncommon | 2 | 防7(+3) | 获得7布防，生成2冰霜，升级10布防。 | 费用2，布防7/10，压制2层 | 冰墙：2费，获得布防并施加两个压制。 | adapt |
| Go for the Eyes `GO_FOR_THE_EYES` | Attack/Common | 0 | 伤3(+1) | 造成3伤害，若敌人攻击施加1虚弱，升级4伤害2虚弱。 | 费用0，伤害3/4，压制1/2 | 眼部干扰：0费，对攻击意图敌人施加压制。 | direct |
| Heatsinks `HEATSINKS` | Power/Uncommon | 1 | — | 每打出一张能力牌抽1卡，升级抽2。 | 费用1，抽牌1/2 | 散热抽排：1费能力，能力链抽牌。 | direct |
| Hello World `HELLO_WORLD` | Power/Uncommon | 1 | — | 每回合开始添加随机普通牌，升级固有。 | 费用1，升级固有 | 基础补给：1费能力，每回合生成基础战术卡。 | adapt |
| Hologram `HOLOGRAM` | Skill/Common | 1 | 防3(+2) | 获得3布防，从弃牌堆回收一张牌，消耗，升级5布防。 | 费用1，布防3/5，升级可能移除消耗 | 全息回收：1费，获得布防并回收弃牌堆一张卡。 | direct |
| Hyperbeam `HYPERBEAM` | Attack/Rare | 2 | 伤26(+8) | 所有敌人受到26伤害，失去3专注，升级34。 | 费用2，伤害26/34，失去3专注 | 轨道炮：2费，高额范围伤害但损失全局效能。 | adapt |
| Impulse `IMPULSE` | Skill/Uncommon | 1 | — | 无描述，消耗，升级无描述。 | 数据异常，费用1，消耗 | 未定义，需重设。 | defer |
| Leap `LEAP` | Skill/Common | 1 | 防9(+3) | 获得9布防，升级12。 | 费用1，布防9/12 | 战术翻滚：1费，获得9/12布防。 | direct |
| Bullseye `LOCKON` | Attack/Uncommon | 1 | 伤8(+3) | 造成8伤害，施加2锁定，升级11伤害3锁定。 | 费用1，伤害8/11，锁定2/3 | 目标标记：1费，伤害并施加标记，提升后续伤害。 | adapt |
| Loop `LOOP` | Power/Uncommon | 1 | — | 每回合开始触发下一个球体被动，升级触发两次。 | 费用1，触发1/2次 | 自动循环：1费能力，每回合自动触发一个战术装置被动。 | adapt |
| Machine Learning `MACHINE_LEARNING` | Power/Rare | 1 | — | 每回合开始额外抽1卡，升级固有。 | 费用1，升级固有 | 战术学习：1费能力，每回合多抽1。 | direct |
| Melter `MELTER` | Attack/Uncommon | 1 | 伤10(+4) | 移除敌人全部布防并造成10伤害，升级14。 | 费用1，伤害10/14 | 熔毁弹：1费，无视并移除敌方布防后伤害。 | direct |
| Meteor Strike `METEOR_STRIKE` | Attack/Rare | 5 | 伤24(+6) | 造成24伤害，生成3等离子，升级30。 | 原作5费，需重调至0-3费内 | 轨道打击：适配为3费，伤害大幅降低并部署等离子。 | adapt |
| Multi-Cast `MULTI_CAST` | Skill/Rare | X | — | 花费X能量，激发下一个球体X次，升级X+1。 | X费用，升级X+1 | 多重激活：X费，多次触发一个战术装置。 | adapt |
| Rainbow `RAINBOW` | Skill/Rare | 2 | — | 生成闪电、冰霜、黑暗各1，消耗，升级移除消耗。 | 费用2，生成3装置，升级不消耗 | 多功能部署：2费，部署三种不同类型装置。 | adapt |
| Reboot `REBOOT` | Skill/Rare | 0 | — | 洗回所有牌，抽4卡，消耗，升级抽6。 | 费用0，抽4/6，消耗 | 重置：0费，洗牌并抽牌，消耗。 | direct |
| Rebound `REBOUND` | Attack/Common | 1 | 伤9(+3) | 造成9伤害，将本回合下一张牌置于牌堆顶，升级12。 | 费用1，伤害9/12 | 弹射：1费，伤害并回收下一张卡。 | direct |
| Recycle `RECYCLE` | Skill/Uncommon | 1→0 | — | 消耗一张牌并获得等于其费用的能量，升级0费。 | 费用1，升级0 | 回收利用：1费/0费，消耗卡换取能量。 | direct |
| Recursion `REDO` | Skill/Common | 1→0 | — | 激发下一个球体并重新生成相同球体，升级0费。 | 费用1，升级0 | 递归：1费/0费，重新激活并保留一个战术装置。 | adapt |
| Reinforced Body `REINFORCED_BODY` | Skill/Uncommon | X | 防7(+2) | 花费X能量，获得7布防X次，升级9布防。 | X费用，布防7/9每次 | 加固工事：X费，重复获得布防。 | direct |
| Reprogram `REPROGRAM` | Skill/Uncommon | 1 | — | 失去1专注，获得1力量和1敏捷，升级失去2专注。 | 费用1，专注-1/-2，获力量敏捷+1 | 重组：1费，牺牲全局效能提升自身战斗属性。 | adapt |
| Rip and Tear `RIP_AND_TEAR` | Attack/Uncommon | 1 | 伤7(+2) | 对随机敌人造成7伤害两次，升级9。 | 费用1，伤害7/9*2 | 散射开火：1费，随机目标两次伤害。 | direct |
| Scrape `SCRAPE` | Attack/Uncommon | 1 | 伤7(+3) | 造成7伤害，抽4卡，丢弃非0费卡，升级10伤害抽5。 | 费用1，伤害7/10，抽4/5 | 快拔：1费，伤害并抽牌，仅保留0费卡。 | direct |
| Seek `SEEK` | Skill/Rare | 0 | — | 从抽牌堆搜索一张卡入手，消耗，升级搜索两张。 | 费用0，搜索1/2，消耗 | 战术规划：0费，定向检索，消耗。 | direct |
| Self Repair `SELF_REPAIR` | Power/Uncommon | 1 | — | 战斗结束回复7生命，升级10。 | 费用1，回复7/10 | 自修复：1费能力，战后恢复生命。 | direct |
| Skim `SKIM` | Skill/Uncommon | 1 | — | 抽3卡，升级抽4。 | 费用1，抽3/4 | 快速扫描：1费，抽牌。 | direct |
| Stack `STACK` | Skill/Common | 1 | 防0(+3) | 获得等于弃牌堆卡牌数量的布防，升级额外+3。 | 费用1，布防=弃牌堆数量，升级+3 | 废料护盾：1费，布防等于弃牌堆数量。 | direct |
| Static Discharge `STATIC_DISCHARGE` | Power/Uncommon | 1 | — | 每受未格挡伤害生成1闪电，升级2。 | 费用1，生成1/2 | 自动反击：1费能力，受伤时部署电击装置。 | adapt |
| Steam Barrier `STEAM` | Skill/Common | 0 | 防6(+2) | 获得6布防，本场战斗此卡布防-1，升级8。 | 费用0，布防6/8，每次使用后-1 | 蒸汽护盾：0费，临时布防随使用衰减。 | direct |
| Overclock `STEAM_POWER` | Skill/Uncommon | 0 | — | 抽2卡并添加一张燃烧到弃牌堆，升级抽3。 | 费用0，抽2/3，加1燃烧 | 超频：0费，抽牌但加入过热废牌。 | direct |
| Storm `STORM` | Power/Uncommon | 1 | — | 每打出一张能力牌生成1闪电，升级固有。 | 费用1，升级固有 | 风暴：1费能力，能力链部署电击装置。 | adapt |
| Streamline `STREAMLINE` | Attack/Common | 2 | 伤15(+5) | 造成15伤害，本场战斗此卡费用-1，升级20。 | 费用2（可降），伤害15/20 | 流线化：2费，伤害高且使用后降低费用。 | direct |
| Strike `STRIKE_B` | Attack/Basic | 1 | 伤6(+3) | 造成6伤害，升级9。 | 费用1，伤害6/9 | 基础射击：1费，伤害6/9。 | direct |
| Sunder `SUNDER` | Attack/Uncommon | 3 | 伤24(+8) | 造成24伤害，若击杀获得3能量，升级32。 | 费用3，伤害24/32，奖励3能量 | 处决：3费，高伤害，击杀奖励能量。 | direct |
| Sweeping Beam `SWEEPING_BEAM` | Attack/Common | 1 | 伤6(+3) | 所有敌人受到6伤害，抽1卡，升级9。 | 费用1，伤害6/9范围，抽1 | 横扫光束：1费，范围伤害并抽牌。 | direct |
| Tempest `TEMPEST` | Skill/Uncommon | X | — | 花费X能量生成X个闪电，消耗，升级X+1。 | X费用，生成X/X+1，消耗 | 雷暴：X费，消耗能量部署多个电击装置。 | adapt |
| Thunder Strike `THUNDER_STRIKE` | Attack/Rare | 3 | 伤7(+2) | 对随机敌人造成7伤害，每本场生成过的闪电一次，升级9。 | 费用3，伤害7/9每次 | 雷霆打击：3费，根据已部署电击装置数量多次随机打击。 | adapt |
| TURBO `TURBO` | Skill/Common | 0 | — | 获得2能量，添加一张虚空到弃牌堆，升级3。 | 费用0，能量2/3，加1虚空 | 涡轮增压：0费，获得能量但加入负面卡。 | direct |
| Equilibrium `UNDO` | Skill/Uncommon | 2 | 防13(+3) | 获得13布防，保留手牌，升级16。 | 费用2，布防13/16 | 平衡：2费，布防并保留当前手牌。 | direct |
| White Noise `WHITE_NOISE` | Skill/Uncommon | 1→0 | — | 添加随机能力牌入手，本回合费用为0，消耗，升级0费。 | 费用1，升级0 | 白噪音：1费/0费，生成随机能力卡并本回合免费。 | adapt |
| Zap `ZAP` | Skill/Basic | 1→0 | — | 生成1个闪电，升级0费。 | 费用1，升级0 | 电磁脉冲：1费/0费，部署一个电击装置。 | adapt |

## 观者（76 条）

| 原卡 | 类型/稀有度 | 费用 | 基础数值 | 原机制简述 | 升级与数值（初筛） | 战术转写方向 | 采用 |
|---|---|---:|---|---|---|---|---|
| Rushdown `ADAPTATION` | Power/Uncommon | 1→0 | — | 进入愤怒时抽2牌 | 1费，升级0费，抽牌数不变 | 战术兴奋剂：进入交火状态时立即补充2张手牌 | adapt |
| Alpha `ALPHA` | Skill/Rare | 1 | — | 洗入Beta，消耗 | 1费，升级获得固有，效果不变 | 信号诱饵：制造一个后续可引爆的战术标记 | adapt |
| Battle Hymn `BATTLEHYMN` | Power/Uncommon | 1 | — | 每回合手牌加入一张Smite | 1费，升级获得固有 | 火力支援协议：每回合自动生成一发战术打击牌 | adapt |
| Blasphemy `BLASPHEMY` | Skill/Rare | 1 | — | 进入神格，下回合死亡，消耗 | 1费，升级获得保留 | 超载协议：获得极高战术优势但下回合强制撤退 | adapt |
| Bowling Bash `BOWLINGBASH` | Attack/Common | 1 | 伤7(+3) | 对每个敌人造成7伤 | 1费，升级伤害+3 | 区域扫射：对所有可见敌人造成等量伤害 | direct |
| Brilliance `BRILLIANCE` | Attack/Rare | 1 | 伤12(+4) | 12伤，额外等于本场神格获取量 | 1费，升级伤害+4 | 灵光突袭：基于情报累积造成额外伤害 | adapt |
| Carve Reality `CARVEREALITY` | Attack/Uncommon | 1 | 伤6(+4) | 6伤，手牌加入一张Smite | 1费，升级伤害+4 | 现实切割：攻击并生成后续打击牌 | adapt |
| Tranquility `CLEARTHEMIND` | Skill/Common | 1→0 | — | 保留，进入平静，消耗 | 1费，升级0费 | 战术静默：保留并切换至隐匿姿态 | adapt |
| Collect `COLLECT` | Skill/Uncommon | X | — | X费，下X回合开始时获得奇迹+ | X费，升级为X+1回合 | 资源预埋：消耗当前资源换取未来多回合补给 | adapt |
| Conclude `CONCLUDE` | Attack/Uncommon | 1 | 伤12(+4) | 对全体12伤，结束回合 | 1费，升级伤害+4 | 压制终结：对区域敌人打击并强制结束行动 | direct |
| Conjure Blade `CONJUREBLADE` | Skill/Rare | X | — | X费，洗入一张Expunger | X费，升级为X+1 | 锻造协议：消耗资源制造一张未来可用的重型攻击 | adapt |
| Consecrate `CONSECRATE` | Attack/Common | 0 | 伤5(+3) | 对全体5伤 | 0费，升级伤害+3 | 区域轰炸：对所有敌人造成小额范围伤害 | direct |
| Crescendo `CRESCENDO` | Skill/Common | 1→0 | — | 保留，进入愤怒，消耗 | 1费，升级0费 | 战斗号令：保留并切换至攻击姿态 | adapt |
| Crush Joints `CRUSHJOINTS` | Attack/Common | 1 | 伤8(+2) | 8伤，若上一张是技能则施加1易伤 | 1费，升级伤害+2，易伤+1 | 破绽打击：若之前使用了战术技能，附加暴露效果 | direct |
| Cut Through Fate `CUTTHROUGHFATE` | Attack/Common | 1 | 伤7(+2) | 7伤，占卜2，抽1 | 1费，升级伤害+2，占卜+1 | 情报预判：攻击并调整牌序，补一张手牌 | adapt |
| Deceive Reality `DECEIVEREALITY` | Skill/Uncommon | 1 | 防4(+3) | 4格挡，手牌加入一张Safety | 1费，升级格挡+3 | 烟雾掩护：获得格挡并生成防御牌 | adapt |
| Defend `DEFEND_P` | Skill/Basic | 1 | 防5(+3) | 5格挡 | 1费，升级格挡+3 | 基础布防：获得格挡 | direct |
| Deus Ex Machina `DEUSEXMACHINA` | Skill/Rare | 不可打出 | — | 不可用，抽到时生成2奇迹并消耗 | 无法打出，升级生成3奇迹 | 应急协议：抽到自动触发补给 | adapt |
| Deva Form `DEVAFORM` | Power/Rare | 3 | — | 每回合获得能量并递增 | 3费，升级移除虚化 | 能源核心：每回合资源增长 | adapt |
| Devotion `DEVOTION` | Power/Rare | 1 | — | 每回合获得2真言 | 1费，升级获得3真言 | 专注冥想：每回合积累神格进度 | adapt |
| Empty Body `EMPTYBODY` | Skill/Common | 1 | 防7(+3) | 7格挡，退出姿态 | 1费，升级格挡+3 | 脱离接触：格挡并解除当前战术姿态 | adapt |
| Empty Fist `EMPTYFIST` | Attack/Common | 1 | 伤9(+5) | 9伤，退出姿态 | 1费，升级伤害+5 | 直击脱离：攻击并退出当前姿态 | adapt |
| Empty Mind `EMPTYMIND` | Skill/Uncommon | 1 | — | 抽2，退出姿态 | 1费，升级抽3张 | 冷静复盘：抽牌并退出当前姿态 | adapt |
| Eruption `ERUPTION` | Attack/Basic | 2→1 | 伤9 | 9伤，进入愤怒 | 2费，升级降为1费 | 突进爆发：造成伤害并进入攻击姿态 | direct |
| Establishment `ESTABLISHMENT` | Power/Rare | 1 | — | 保留的卡本场费用降低1 | 1费，升级获得固有 | 后勤优化：保留卡牌永久减费 | adapt |
| Evaluate `EVALUATE` | Skill/Common | 1 | 防6(+4) | 6格挡，洗入一张Insight | 1费，升级格挡+4 | 战术评估：防御并加入情报牌 | adapt |
| Fasting `FASTING2` | Power/Uncommon | 2 | — | 获得3力量3敏捷，每回合少1能量 | 2费，升级力量+1 | 极限状态：强化攻防但减少资源获取 | adapt |
| Fear No Evil `FEARNOEVIL` | Attack/Uncommon | 1 | 伤8(+3) | 8伤，若敌人意图攻击则进入平静 | 1费，升级伤害+3 | 反制预判：攻击并利用敌人攻击转换为战术优势 | adapt |
| Flurry of Blows `FLURRYOFBLOWS` | Attack/Common | 0 | 伤4(+2) | 4伤，姿态切换时从弃牌堆回手 | 0费，升级伤害+2 | 连击惯性：姿态变化时回收此攻击 | adapt |
| Flying Sleeves `FLYINGSLEEVES` | Attack/Common | 1 | 伤4(+2) | 保留，打4两次 | 1费，升级每次伤害+2 | 双段打击：保留并进行两次快速攻击 | direct |
| Follow-Up `FOLLOWUP` | Attack/Common | 1 | 伤7(+4) | 7伤，若上一张是攻击则获得1能量 | 1费，升级伤害+4 | 连携推进：攻击后若接续攻击则恢复资源 | direct |
| Foreign Influence `FOREIGNINFLUENCE` | Skill/Uncommon | 0 | — | 0费，选择1张任意颜色攻击牌加入手牌，消耗 | 0费，升级使该牌本回合0费 | 外部情报：获得随机攻击牌 | adapt |
| Halt `HALT` | Skill/Common | 0 | 防3(+1) | 3格挡，若在愤怒则额外9格挡 | 0费，升级基础格挡+1 | 应急掩体：防御，攻击姿态下效果增强 | direct |
| Indignation `INDIGNATION` | Skill/Uncommon | 1 | — | 若在愤怒则给全体3易伤，否则进入愤怒 | 1费，升级易伤+2 | 压制怒火：攻击姿态下施加易伤，否则切换姿态 | direct |
| Inner Peace `INNERPEACE` | Skill/Uncommon | 1 | — | 若在平静抽3，否则进入平静 | 1费，升级抽4张 | 心智安抚：平静时抽牌，否则切换平静 | direct |
| Judgment `JUDGEMENT` | Skill/Rare | 1 | — | 若敌人HP≤30则直接击杀 | 1费，升级阈值+10 | 精确处决：对低血量敌人一击必杀 | adapt |
| Just Lucky `JUSTLUCKY` | Attack/Common | 0 | 伤3(+1)、防2(+1) | 占卜1，2格挡，3伤 | 0费，升级全效果+1 | 微操调整：占卜并同时获得攻防收益 | adapt |
| Lesson Learned `LESSONLEARNED` | Attack/Rare | 2 | 伤10(+3) | 10伤，若击杀则升级随机卡，消耗 | 2费，升级伤害+3 | 战后复盘：击杀后永久强化一张卡 | adapt |
| Like Water `LIKEWATER` | Power/Uncommon | 1 | — | 回合结束若在平静获得5格挡 | 1费，升级格挡+2 | 静默防护：平静状态下回合结束自动获得格挡 | adapt |
| Master Reality `MASTERREALITY` | Power/Rare | 1→0 | — | 战斗中生成的卡自动升级 | 1费，升级降为0费 | 质量管控：所有临时生成的卡牌获得强化 | adapt |
| Meditate `MEDITATE` | Skill/Uncommon | 1 | — | 弃牌堆一张回手并保留，进入平静，结束回合 | 1费，升级回收2张 | 战术回收：回收弃牌并切换平静后结束行动 | adapt |
| Mental Fortress `MENTALFORTRESS` | Power/Uncommon | 1 | — | 姿态切换时获得4格挡 | 1费，升级格挡+2 | 心理防线：每次姿态变化获得防御加成 | adapt |
| Nirvana `NIRVANA` | Power/Uncommon | 1 | — | 占卜时获得3格挡 | 1费，升级格挡+1 | 预判护盾：占卜动作附带格挡 | adapt |
| Omniscience `OMNISCIENCE` | Skill/Rare | 4→3 | — | 4费，选择抽牌堆一张牌打出两次并消耗 | 4费，升级降为3费 | 全知调度：高费强力双发一张抽牌堆牌 | defer |
| Pressure Points `PATHTOVICTORY` | Skill/Common | 1 | — | 施加8印记，全体敌人失去等于印记的HP | 1费，升级印记+3 | 标记集火：施加印记并立即结算伤害 | adapt |
| Perseverance `PERSEVERANCE` | Skill/Uncommon | 1 | 防5(+2) | 保留，5格挡，保留时本场格挡+2 | 1费，升级基础格挡+2，保留成长+1 | 持续加固：保留时逐渐增强防御 | adapt |
| Pray `PRAY` | Skill/Uncommon | 1 | — | 获得3真言，洗入一张Insight | 1费，升级真言+1 | 祈祷蓄力：累积神格并加入情报 | adapt |
| Prostrate `PROSTRATE` | Skill/Common | 0 | 防4 | 2真言，4格挡 | 0费，升级真言+1 | 低姿防御：同时获得神格进度和格挡 | adapt |
| Protect `PROTECT` | Skill/Common | 2 | 防12(+4) | 保留，12格挡 | 2费，升级格挡+4 | 预备防御：高额格挡可保留 | direct |
| Ragnarok `RAGNAROK` | Attack/Rare | 3 | 伤5(+1) | 随机敌人5次5伤 | 3费，升级伤害+1，次数+1 | 饱和轰炸：随机分配多次伤害 | adapt |
| Reach Heaven `REACHHEAVEN` | Attack/Uncommon | 2 | 伤10(+5) | 10伤，洗入一张Through Violence | 2费，升级伤害+5 | 蓄势重击：攻击并埋入后续重击牌 | adapt |
| Sanctity `SANCTITY` | Skill/Uncommon | 1 | 防6(+3) | 6格挡，若上一张是技能则抽2 | 1费，升级格挡+3 | 技能连携：使用技能后防御并补充手牌 | direct |
| Sands of Time `SANDSOFTIME` | Attack/Uncommon | 4 | 伤20(+6) | 保留，20伤，保留时本场费用-1 | 4费，升级伤害+6 | 倒计时打击：保留越久费用越低 | adapt |
| Sash Whip `SASHWHIP` | Attack/Common | 1 | 伤8(+2) | 8伤，若上一张是攻击则施加1虚弱 | 1费，升级伤害+2，虚弱+1 | 压制接续：攻击后施加压制 | direct |
| Scrawl `SCRAWL` | Skill/Rare | 1→0 | — | 抽牌直到手牌满，消耗 | 1费，升级0费 | 紧急补给：填满手牌 | direct |
| Signature Move `SIGNATUREMOVE` | Attack/Uncommon | 2 | 伤30(+10) | 2费，手中仅此一张攻击时打30 | 2费，升级伤害+10 | 孤注一掷：满足条件时造成高额伤害 | adapt |
| Spirit Shield `SPIRITSHIELD` | Skill/Rare | 2 | — | 手牌每张3格挡 | 2费，升级每张格挡+1 | 协同防御：依手牌数量获得格挡 | direct |
| Strike `STRIKE_P` | Attack/Basic | 1 | 伤6(+3) | 6伤 | 1费，升级伤害+3 | 基础射击 | direct |
| Study `STUDY` | Power/Uncommon | 2→1 | — | 每回合结束洗入一张Insight | 2费，升级降为1费 | 持续侦察：每回合获得情报牌 | adapt |
| Swivel `SWIVEL` | Skill/Uncommon | 2 | 防8(+3) | 8格挡，下一张攻击0费 | 2费，升级格挡+3 | 战术转体：防御并使下次攻击免费 | adapt |
| Talk to the Hand `TALKTOTHEHAND` | Attack/Uncommon | 1 | 伤5(+2) | 5伤，每次攻击该敌人获得2格挡，消耗 | 1费，升级伤害+2，格挡+1 | 嘲讽吸引：攻击后对同一目标每次攻击回防 | adapt |
| Tantrum `TANTRUM` | Attack/Uncommon | 1 | 伤3 | 3伤3次，进入愤怒，洗回抽牌堆 | 1费，升级每段伤害+1 | 狂暴连击：多段攻击并进入愤怒，循环使用 | adapt |
| Third Eye `THIRDEYE` | Skill/Common | 1 | 防7(+2) | 7格挡，占卜3 | 1费，升级格挡+2，占卜+2 | 洞察防御：格挡并预判牌序 | adapt |
| Unraveling `UNRAVELING` | Skill/Rare | 2→1 | — | 2费，从左到右随机目标打出所有手牌，消耗 | 2费，升级降为1费 | 无序开火：随机目标自动打出所有手牌 | defer |
| Vault `VAULT` | Skill/Rare | 3→2 | — | 3费，获得额外回合，结束回合，消耗 | 3费，升级降为2费 | 时间重置：立即获得额外行动回合 | adapt |
| Simmering Fury `VENGEANCE` | Skill/Uncommon | 1 | — | 下回合开始进入愤怒并抽2 | 1费，升级抽牌+1 | 延迟爆发：下回合获得攻击姿态和补给 | adapt |
| Vigilance `VIGILANCE` | Skill/Basic | 2 | 防8(+4) | 8格挡，进入平静 | 2费，升级格挡+4 | 警戒姿态：防御并切换平静 | direct |
| Wallop `WALLOP` | Attack/Uncommon | 2 | 伤9(+3) | 9伤，获得等于未格挡伤害的格挡 | 2费，升级伤害+3 | 吸血打击：造成伤害回复等量防护 | adapt |
| Wave of the Hand `WAVEOFTHEHAND` | Skill/Uncommon | 1 | — | 本回合每次获得格挡给全体1虚弱 | 1费，升级虚弱+1 | 压制波动：防御时给敌人施加压制 | adapt |
| Weave `WEAVE` | Attack/Uncommon | 0 | 伤4(+2) | 0费，4伤，占卜时从弃牌堆回手 | 0费，升级伤害+2 | 预判连击：占卜时回收此攻击 | adapt |
| Wheel Kick `WHEELKICK` | Attack/Uncommon | 2 | 伤15(+5) | 15伤，抽2 | 2费，升级伤害+5 | 回旋打击：高伤并补充手牌 | direct |
| Windmill Strike `WINDMILLSTRIKE` | Attack/Uncommon | 2 | 伤7(+3) | 保留，7伤，保留时本场伤害+4 | 2费，升级基础伤害+3，成长+1 | 蓄力重击：保留越久伤害越高 | adapt |
| Foresight `WIREHEADING` | Power/Uncommon | 1 | — | 每回合开始占卜3 | 1费，升级占卜+1 | 战场预测：每回合自动占卜 | adapt |
| Wish `WISH` | Skill/Rare | 3 | 伤3(+1)、防6(+2) | 选择：6铠甲/3力量/25金币，消耗 | 3费，升级各选项数值提升 | 战术愿望：选择防御强化、攻击强化或资源 | adapt |
| Worship `WORSHIP` | Skill/Uncommon | 2 | — | 获得5真言 | 2费，升级获得保留 | 神格充能：直接积累神格 | adapt |
| Wreath of Flame `WREATHOFFLAME` | Skill/Uncommon | 1 | — | 下次攻击额外5伤 | 1费，升级额外伤害+3 | 火焰预兆：强化下次攻击 | direct |

## 无色牌与状态（44 条）

| 原卡 | 类型/稀有度 | 费用 | 基础数值 | 原机制简述 | 升级与数值（初筛） | 战术转写方向 | 采用 |
|---|---|---:|---|---|---|---|---|
| Apotheosis `APOTHEOSIS` | Skill/Rare | 2→1 | — | 本场战斗全部牌升级，随后消耗；升级后费用 2→1 | 原费用2，升级费用1 | 战术精通：本场战斗所有已入手及将入手的卡牌变为升级版，消耗。 | adapt |
| Bandage Up `BANDAGE_UP` | Skill/Uncommon | 0 | — | 回复4HP，消耗 | 费用0，升级回复+2（至6） | 战术绷带：恢复4点生命，消耗。 | direct |
| Bite `BITE` | Attack/Special | 1 | 伤7(+1) | 造成7伤害，回复2 | 费用1，升级伤害+1，回复+1 | 吸血突击：造成7伤害并回复2生命，升级后8伤害3回复。 | adapt |
| Blind `BLIND` | Skill/Uncommon | 0 | — | 单体2压制 | 费用0，升级目标变全体 | 闪光干扰：对单体敌人施加2层压制（降低输出），升级后全体。 | direct |
| Burn `BURN` | Status/Common | 不可打出 | — | 不可打出，回合结束自伤2 | 费用无，升级伤害+2 | 灼烧：负面状态卡，回合结束若在手受到2伤害，升级4。 | adapt |
| Chrysalis `CHRYSALIS` | Skill/Rare | 2 | — | 洗3随机技能进抽牌堆，本场0费，消耗 | 费用2，升级洗入数量+2 | 战术蛹化：洗3张随机战术技能进入抽牌堆且本场费用为0，消耗，升级5张。 | adapt |
| Dark Shackles `DARK_SHACKLES` | Skill/Uncommon | 0 | — | 敌人本回合-9力量 | 费用0，升级数值+6 | 暗影镣铐：令一个敌人本回合攻击力降低9，消耗，升级降低15。 | direct |
| Dazed `DAZED` | Status/Common | 不可打出 | — | 不可打出，虚无 | 费用无 | 眩晕：负面状态，回合结束弃掉，不可打出。 | adapt |
| Deep Breath `DEEP_BREATH` | Skill/Uncommon | 0 | — | 洗回弃牌堆，抽1 | 费用0，升级+1抽牌 | 深呼吸：将弃牌堆洗入抽牌堆并抽1张，升级抽2。 | direct |
| Discovery `DISCOVERY` | Skill/Uncommon | 1 | — | 3选1随机卡加入手牌本回合0费，消耗 | 费用1，升级可能移除消耗（输入有误） | 战地搜索：发现1张随机战术牌加入手牌，本回合费用0，消耗；升级应改为不消耗（修正）。 | adapt |
| Dramatic Entrance `DRAMATIC_ENTRANCE` | Attack/Uncommon | 0 | 伤8(+4) | 固有，全体8伤害，消耗 | 费用0，升级伤害+4 | 戏剧登场：回合开始时必在手，对全体敌人造成8伤害，消耗，升级12。 | direct |
| Enlightenment `ENLIGHTENMENT` | Skill/Uncommon | 0 | — | 本回合手牌费用变1 | 费用0，升级持续时间变全场 | 战术简化：本回合所有手牌费用降至1；升级后本场持续。 | adapt |
| Finesse `FINESSE` | Skill/Uncommon | 0 | 防2(+2) | 获得2布防，抽1 | 费用0，升级布防+2 | 灵巧走位：获得2布防并抽1张牌，升级布防4。 | direct |
| Flash of Steel `FLASH_OF_STEEL` | Attack/Uncommon | 0 | 伤3(+3) | 伤害3，抽1 | 费用0，升级伤害+3 | 钢刃闪光：造成3伤害并抽1张牌，升级6。 | direct |
| Forethought `FORETHOUGHT` | Skill/Uncommon | 0 | — | 选一张手牌放到底，费用0 | 费用0，升级可多选 | 先见之明：将一张手牌放入抽牌堆底部并使其费用变为0；升级可操作任意数量。 | adapt |
| Apparition `GHOSTLY` | Skill/Special | 1 | — | 获得1无形，消耗 | 费用1，升级可能移除消耗（输入有误） | 幽灵闪避：获得1层无形（本回合受伤归0），消耗；升级应不消耗（修正）。 | adapt |
| Good Instincts `GOOD_INSTINCTS` | Skill/Uncommon | 0 | 防6(+3) | 获得6布防 | 费用0，升级+3 | 可靠直觉：获得6布防，升级9。 | direct |
| Hand of Greed `HANDOFGREED` | Attack/Rare | 2 | 伤20(+5) | 伤害20，击杀得金币 | 费用2，升级伤害+5，金币+5 | 贪婪之手：造成20伤害，若击杀目标获得等量资源，升级25。 | adapt |
| Impatience `IMPATIENCE` | Skill/Uncommon | 0 | — | 条件抽牌2 | 费用0，升级+1抽牌 | 焦躁：若手中无攻击牌，抽2张；升级抽3。 | direct |
| Jack of All Trades `JACK_OF_ALL_TRADES` | Skill/Uncommon | 0 | — | 添加1随机无色卡，消耗 | 费用0，升级数量+1 | 多面手：将1张随机战术牌加入手牌，消耗；升级2张。 | adapt |
| J.A.X. `J_A_X` | Skill/Special | 0 | — | 失去3HP，获得2力量 | 费用0，升级力量+1 | 强化剂：生命值-3，获得2点攻击强化；升级+3攻击。 | adapt |
| Madness `MADNESS` | Skill/Uncommon | 1→0 | — | 随机手牌变0费，消耗 | 费用1，升级变0费 | 疯狂：随机一张手牌本场费用变为0，消耗；升级自身0费。 | adapt |
| Magnetism `MAGNETISM` | Power/Rare | 2→1 | — | 每回合开始获得随机无色卡 | 费用2，升级费用1 | 磁力：每回合开始时获得1张随机战术牌；升级费用降低。 | adapt |
| Master of Strategy `MASTER_OF_STRATEGY` | Skill/Rare | 0 | — | 抽3，消耗 | 费用0，升级+1抽牌 | 战略大师：抽3张牌，消耗；升级抽4。 | direct |
| Mayhem `MAYHEM` | Power/Rare | 2→1 | — | 每回合开始自动打牌堆顶 | 费用2，升级费用1 | 混乱：每回合开始自动打出抽牌堆顶牌；升级费用降低。 | adapt |
| Metamorphosis `METAMORPHOSIS` | Skill/Rare | 2 | — | 洗3随机攻击，0费 | 费用2，升级数量+2 | 异变：洗3张随机攻击牌进入抽牌堆且本场费用0，消耗；升级5张。 | adapt |
| Mind Blast `MIND_BLAST` | Attack/Uncommon | 2→1 | 伤0 | 固有，伤害基于抽牌堆数量 | 费用2，升级费用1 | 心灵冲击：固有，造成等同于抽牌堆卡牌数量的伤害；升级费用降低。 | adapt |
| Panacea `PANACEA` | Skill/Uncommon | 0 | — | 获得1人工制品，消耗 | 费用0，升级+1层 | 万能药：获得1层净化（抵挡一次负面状态），消耗；升级2层。 | direct |
| Panache `PANACHE` | Power/Rare | 0 | — | 每打出5张牌全体10伤 | 费用0，升级伤害+4 | 花式秀：每回合打出5张牌后对全体敌人造成10伤害；升级伤害14。 | adapt |
| Panic Button `PANICBUTTON` | Skill/Uncommon | 0 | 防30(+10) | 获得30布防，后续2回合无法获得布防 | 费用0，升级布防+10 | 紧急防护：获得30布防，但接下来2回合布防来源失效，消耗；升级40。 | adapt |
| Purity `PURITY` | Skill/Uncommon | 0 | — | 消耗最多3手牌 | 费用0，升级可消耗数量+2 | 净化：消耗手中最多3张牌（清除负面），本身消耗；升级5张。 | direct |
| Ritual Dagger `RITUALDAGGER` | Attack/Special | 1 | — | 击杀永久增强，消耗 | 费用1，基础伤害缺失，升级永久成长+2 | 仪式匕首：造成伤害，若击杀目标，永久提升此卡伤害3点，消耗；升级提升5点。原输入缺基础伤害（应补15）。 | adapt |
| Sadistic Nature `SADISTIC_NATURE` | Power/Rare | 0 | — | 施加debuff时额外伤害 | 费用0，升级伤害+2 | 虐待狂：每当对敌人施加负面状态，额外造成5伤害；升级7。 | adapt |
| Secret Technique `SECRET_TECHNIQUE` | Skill/Rare | 0 | — | 找一张技能，消耗 | 费用0，升级可能移除消耗（输入有误） | 秘密技巧：从抽牌堆检索一张技能牌入手，消耗；升级应可保留（修正）。 | direct |
| Secret Weapon `SECRET_WEAPON` | Skill/Rare | 0 | — | 找一张攻击，消耗 | 费用0，升级可能移除消耗（输入有误） | 秘密武器：从抽牌堆检索一张攻击牌入手，消耗；升级可保留。 | direct |
| Slimed `SLIMED` | Status/Common | 1 | — | 消耗 | 费用1 | 粘液：状态卡，可打出消耗以清除，占手牌槽。 | adapt |
| Swift Strike `SWIFT_STRIKE` | Attack/Uncommon | 0 | 伤7(+3) | 伤害7 | 费用0，升级伤害+3 | 迅捷打击：造成7伤害，升级10。 | direct |
| The Bomb `THE_BOMB` | Skill/Rare | 2 | — | 延迟3回合全体40伤 | 费用2，升级伤害+10 | 定时炸弹：放置一个延迟3回合爆炸的装置，对全体敌人造成40伤害；升级50。 | adapt |
| Thinking Ahead `THINKING_AHEAD` | Skill/Rare | 0 | — | 抽2，置顶1手牌，消耗 | 费用0，升级可能移除消耗（输入有误） | 未雨绸缪：抽2张牌，然后将一张手牌放到抽牌堆顶，消耗；升级可保留。 | direct |
| Transmutation `TRANSMUTATION` | Skill/Rare | X | — | X费添加X随机无色卡 | 费用X(-1)，升级改为升级版卡牌 | 转化：消耗X点资源，添加X张随机战术牌，本回合也费用0，消耗；升级为升级版卡牌。需重设计为固定费用。 | defer |
| Trip `TRIP` | Skill/Uncommon | 0 | — | 单体2易伤 | 费用0，升级目标变全体 | 绊雷：对单体敌人施加2层易伤（受到伤害增加25%），升级后全体。 | direct |
| Violence `VIOLENCE` | Skill/Rare | 0 | — | 检索3攻击，消耗 | 费用0，升级数量+1 | 暴力：从抽牌堆随机抽取3张攻击牌加入手牌，消耗；升级4张。 | direct |
| Void `VOID` | Status/Common | 不可打出 | — | 不可打出，虚无，抽到时失去1能量 | 费用无 | 空洞：抽到时失去1点费用（能量），回合结束弃掉。 | adapt |
| Wound `WOUND` | Status/Common | 不可打出 | — | 不可打出 | 费用无 | 伤口：负面状态，仅占手牌槽。 | adapt |

## 诅咒（14 条）

| 原卡 | 类型/稀有度 | 费用 | 基础数值 | 原机制简述 | 升级与数值（初筛） | 战术转写方向 | 采用 |
|---|---|---:|---|---|---|---|---|
| Ascender's Bane `ASCENDERSBANE` | Curse/Special | 不可打出 | — | 不可打出，虚无，不可移除 | 费用无（不可打出），机制保留 | 升天者余烬：负面状态卡，回合结束若在手弃掉，无法移除。 | adapt |
| Clumsy `CLUMSY` | Curse/Curse | 不可打出 | — | 不可打出，虚无 | 费用无 | 笨拙：负面状态，回合结束若在手弃掉，不可打出。 | adapt |
| Curse of the Bell `CURSEOFTHEBELL` | Curse/Special | 不可打出 | — | 不可打出，不可移除 | 费用无 | 丧钟诅咒：永久负面卡，占据抽牌堆槽位，不可移除。 | adapt |
| Decay `DECAY` | Curse/Curse | 不可打出 | — | 不可打出，回合结束受2伤害 | 费用无 | 衰败：负面状态，回合结束若在手受到2伤害。 | adapt |
| Doubt `DOUBT` | Curse/Curse | 不可打出 | — | 不可打出，回合结束自身获得1压制 | 费用无 | 疑虑：负面状态，回合结束使自己获得1层压制。 | adapt |
| Injury `INJURY` | Curse/Curse | 不可打出 | — | 不可打出 | 费用无 | 受伤：负面卡，仅占手牌槽位，无其他效果。 | adapt |
| Necronomicurse `NECRONOMICURSE` | Curse/Special | 不可打出 | — | 不可打出，不可移除 | 费用无 | 死灵诅咒：永久负面卡，无法移除，每回合可能造成干扰。 | adapt |
| Normality `NORMALITY` | Curse/Curse | 不可打出 | — | 不可打出，限制每回合出牌数 | 费用无 | 常规：负面卡，在手时限制本回合出牌不超过3张。 | adapt |
| Pain `PAIN` | Curse/Curse | 不可打出 | — | 不可打出，打出其他牌自伤1 | 费用无 | 痛苦：负面卡，在手时每打出其他牌损失1生命。 | adapt |
| Parasite `PARASITE` | Curse/Curse | 不可打出 | — | 不可打出，移除代价 | 费用无 | 寄生虫：负面卡，若被清除，损失3最大生命。 | adapt |
| Pride `PRIDE` | Curse/Special | 1 | — | 固有，回合结束复制到抽牌堆顶，消耗 | 费用1，特殊机制 | 傲慢：可打出消耗，但回合结束会复制一张到抽牌堆顶。 | adapt |
| Regret `REGRET` | Curse/Curse | 不可打出 | — | 不可打出，回合结束自伤等于手牌数 | 费用无 | 悔恨：负面卡，回合结束失去等同于手牌数量的生命。 | adapt |
| Shame `SHAME` | Curse/Curse | 不可打出 | — | 不可打出，回合结束自身脆弱 | 费用无 | 羞耻：负面卡，回合结束使自己获得1层脆弱（布防降低）。 | adapt |
| Writhe `WRITHE` | Curse/Curse | 不可打出 | — | 不可打出，固有 | 费用无 | 扭曲：负面卡，开局必在手，占手牌槽。 | adapt |

## 已知源数据和初筛问题

- `IMPULSE` 缺少有效牌面描述，不能以该条设计数值。
- 个别英文描述含图标占位符，机械数字需以独立牌页或游戏内数据核对。
- `upgrade` 既可能改变数字、费用，也可能移除“消耗/虚无”等关键词；只看数值字段会漏掉质变。
- DeepSeek 曾把 `APOTHEOSIS` 的“本场全部卡牌”误归纳成“全部手牌”；本表已纠正此项，其余实施仍需以源数据为准。
- 这份数据不能证明本项目混合四职业牌池与原作任何单职业牌池数值等价；PvP 更需单独验证。

分类与数值分析见 [STS1 机制与数值报告](STS1-CARD-DESIGN-REPORT.md)。
