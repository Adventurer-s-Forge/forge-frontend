import { seedCatalog, type EquipmentPick, type Skill, type Source } from "../data/catalog";
import { CLASS_SKILL_CHOICES } from "../data/classRules";

export const TEST_SKILLS: readonly Skill[] = [
  { id: 'acrobatics', name: 'Acrobatics', ability: 'DEX'},
  { id: 'animal-handling', name: 'Animal Handling', ability: "WIS"},
  { id: 'arcana', name: 'Arcana', ability: 'INT'},
  { id: 'athletics', name: 'Athletics', ability: 'STR'},
  { id: 'deception', name: 'Deception', ability: 'CHA'},
  { id: 'history', name: 'History', ability: 'INT'},
  { id: 'insight', name: 'Insight', ability: 'WIS'},
  { id: 'intimidation', name: 'Intimidation', ability: 'CHA'},
  { id: 'investigation', name: 'Investigation', ability: 'INT'},
  { id: 'medicine', name: 'Medicine', ability: 'WIS'},
  { id: 'nature', name: 'Nature', ability: 'INT'},
  { id: 'perception', name: 'Perception', ability: 'WIS'},
  { id: 'performance', name: 'Performance', ability: 'CHA'},
  { id: 'persuasion', name: 'Persuasion', ability: 'CHA'},
  { id: 'religion', name: 'Religion', ability: 'INT'},
  { id: 'sleight-of-hand', name: 'Sleight of Hand', ability: 'DEX'},
  { id: 'stealth', name: 'Stealth', ability: 'DEX'},
  { id: 'survival', name: 'Survival', ability: 'WIS'},
]

export function seedTestCatalog(): void {
  seedCatalog({
    races: [
      { id: 'srd-2024_human', name: 'Human', sizes: ['Medium', 'Small'],
        heightHints: { Medium: 'about 4–7 feet tall', Small: 'about 2–4 feet tall' },
        speed: 30, darkvisionFt: null,
        traits: [{ name: 'Skillful', desc: 'You gain proficiency in one skill of your choice.' }] },
      { id: 'srd-2024_dwarf', name: 'Dwarf', sizes: ['Medium'],
        heightHints: { Medium: 'about 4–5 feet tall' },
        speed: 30, darkvisionFt: 120, traits: [] },
    ],
    classes: [
      { id: 'srd-2024_fighter', name: 'Fighter', hitDie: 10, primaryAbilities: [], savingThrows: ['STR', 'CON'],
        skillChoices: CLASS_SKILL_CHOICES.fighter,
        casterType: 'NONE', spellCounts: { cantrips: 0, prepared: 0 }, spellSlots: 0,
      startingEquipment: [
        { key: 'A', label: 'Chain mail, Longsword, and 5 GP',
          grants: [
            { text: 'Chain mail', quantity: 1, itemId: 'srd-2024_chain-mail', choosableFrom: null },
            { text: 'Longsword', quantity: 1, itemId: 'srd-2024_longsword', choosableFrom: null },
          ],
          goldCp: 500 },
        { key: 'B', label: '75 GP', grants: [], goldCp: 7500 },
      ], expertiseAt: null, primaryAbilityText: 'Strength or Dexterity', fightingStyleAt: 1, features: [{
        name: 'Second Wind', desc: 'Bonus action: regain 1d10 + level HP.'
      }], proficiencies: {
          armor: 'Light, Medium, and Heavy armor and Shields',
          weapons: 'Simple and Martial weapons',
          skills: 'Choose 2: Acrobatics, Athletics, History, Insight, Intimidation, Persuasion, Perception, or Survival',
        }, },
      { id: 'srd-2024_wizard', name: 'Wizard', hitDie: 6, primaryAbilities: [], savingThrows: ['INT', 'WIS'],
        skillChoices: CLASS_SKILL_CHOICES.wizard, casterType: 'FULL', 
        spellCounts: { cantrips: 1, prepared: 1 }, spellSlots: 2, startingEquipment: [], expertiseAt: null,
        fightingStyleAt: null, features: [], primaryAbilityText: 'Intelligence', 
        proficiencies: { armor: '', weapons: '', skills: '' } },
      { id: 'srd-2024_rogue', name: 'Rogue', hitDie: 8, primaryAbilities: [],
        savingThrows: ['DEX', 'INT'], skillChoices: CLASS_SKILL_CHOICES.rogue,
        casterType: 'NONE', spellCounts: { cantrips: 0, prepared: 0 }, spellSlots: 0,
        startingEquipment: [], expertiseAt: 1, fightingStyleAt: null, features: [], primaryAbilityText: 'Dexterity',
        proficiencies: { armor: '', weapons: '', skills: '' } },
    ],
    backgrounds: [
      { id: 'srd-2024_acolyte', name: 'Acolyte', skillIds: ['insight', 'religion'], initiateClassNames: [],
        abilityOptions: ['INT', 'WIS', 'CHA'], featName: 'Magic Initiate (Cleric)',
        tool: { text: "Calligrapher's Supplies", quantity: 1, itemId: 'srd-2024_calligraphers-supplies', choosableFrom: null },
        startingEquipment: [] },
      { id: 'srd-2024_soldier', name: 'Soldier', skillIds: ['athletics', 'intimidation'], initiateClassNames: [],
        abilityOptions: ['STR', 'DEX', 'CON'], featName: 'Savage Attacker',
        tool: { text: 'Choose one kind of Gaming Set', quantity: 1, itemId: null, choosableFrom: '^srd-2024_gaming-set-' },
        startingEquipment: [] },
    ],
    spells: [
      { id: 'srd-2024_fire-bolt', name: 'Fire Bolt', level: 0, school: 'Evocation', classIds: ['srd-2024_wizard'],
        desc: '', concentration: false, ritual: false, castingTime: '', range: '', duration: '' },
      { id: 'srd-2024_shield', name: 'Shield', level: 1, school: 'Abjuration', classIds: ['srd-2024_wizard'],
        desc: '', concentration: false, ritual: false, castingTime: '', range: '', duration: '' },
    ],
    equipment: [
      { id: 'srd-2024_longsword', name: 'Longsword', category: 'weapon', desc: 'A versatile blade.', costCp: 1500 },
      { id: 'srd-2024_chain-mail', name: 'Chain mail', category: 'armor', desc: 'Heavy interlocking rings.', costCp: 7500,
        armor: { base: 16, addDex: false, capDex: null, stealthDisadvantage: true } },
      { id: 'srd-2024_rope', name: 'Rope (50 feet)', category: 'gear', desc: 'Hempen rope.', costCp: 100 },
      { id: 'srd-2024_gaming-set-dice', name: 'Gaming Set, Dice', category: 'gear', desc: '', costCp: 100 },
      { id: 'srd-2024_gaming-set-playing-cards', name: 'Gaming Set, Playing Cards', category: 'gear', desc: '', costCp: 50 },
    ],
    skills: TEST_SKILLS,
    sources: TEST_SOURCES,
  })
}

export const pick = (key: string, goldCp = 0): EquipmentPick => ({
  key,
  label: `Option ${key}`,
  goldCp,
  grants: [],
})

export const TEST_SOURCES: Source[] = [
  {
    key: 'srd-2024',
    name: 'System Reference Document 5.2',
    displayName: '5e 2024 Rules',
    publisher: 'Wizards of the Coast',
    permalink: 'https://dnd.wizards.com/resources/systems-reference-document',
    license: {
      name: 'Creative Commons Attribution 4.0 International',
      shortName: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/legalcode',
    },
  },
  { key: 'core', name: 'core', displayName: 'core', publisher: '', permalink: '', license: null },
]