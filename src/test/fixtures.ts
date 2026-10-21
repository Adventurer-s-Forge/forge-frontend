import { seedCatalog, type EquipmentPick } from "../data/catalog";
import { CLASS_SKILL_CHOICES } from "../data/classRules";

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
        abilityOptions: ['INT', 'WIS', 'CHA'], startingEquipment: [] },
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
    ],
  })
}

export const pick = (key: string, goldCp = 0): EquipmentPick => ({
  key,
  label: `Option ${key}`,
  goldCp,
  grants: [],
})