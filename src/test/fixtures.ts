import { seedCatalog } from "../data/catalog";
import { CLASS_SKILL_CHOICES } from "../data/classRules";

export function seedTestCatalog(): void {
  seedCatalog({
    races: [
      { id: 'srd-2024_human', name: 'Human', sizes: ['Medium', 'Small'], speed: 30 },
      { id: 'srd-2024_dwarf', name: 'Dwarf', sizes: ['Medium'], speed: 30 },
    ],
    classes: [
      { id: 'srd-2024_fighter', name: 'Fighter', hitDie: 10, primaryAbilities: [], savingThrows: ['STR', 'CON'],
        skillChoices: CLASS_SKILL_CHOICES.fighter,
        casterType: 'NONE', spellCounts: { cantrips: 0, prepared: 0 }, spellSlots: 0 },
      { id: 'srd-2024_wizard', name: 'Wizard', hitDie: 6, primaryAbilities: [], savingThrows: ['INT', 'WIS'],
        skillChoices: CLASS_SKILL_CHOICES.wizard,
        casterType: 'FULL', spellCounts: { cantrips: 1, prepared: 1 }, spellSlots: 2 },
    ],
    backgrounds: [
      { id: 'srd-2024_acolyte', name: 'Acolyte', skillIds: ['insight', 'religion'], initiateClassNames: [],
        abilityOptions: ['INT', 'WIS', 'CHA'] },
    ],
    spells: [
      { id: 'srd-2024_fire-bolt', name: 'Fire Bolt', level: 0, school: 'Evocation', classIds: ['srd-2024_wizard'],
        desc: '', concentration: false, ritual: false, castingTime: '', range: '', duration: '' },
      { id: 'srd-2024_shield', name: 'Shield', level: 1, school: 'Abjuration', classIds: ['srd-2024_wizard'],
        desc: '', concentration: false, ritual: false, castingTime: '', range: '', duration: '' },
    ],
    equipment: [
      { id: 'srd-2024_longsword', name: 'Longsword', category: 'weapon', desc: 'A versatile blade.' },
      { id: 'srd-2024_chain-mail', name: 'Chain mail', category: 'armor', desc: 'Heavy interlocking rings.' },
      { id: 'srd-2024_rope', name: 'Rope (50 feet)', category: 'gear', desc: 'Hempen rope.' },
    ],
  })
}