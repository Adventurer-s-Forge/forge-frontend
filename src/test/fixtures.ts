import { seedCatalog } from "../data/catalog";
import { CLASS_SKILL_CHOICES } from "../data/classRules";

export function seedTestCatalog(): void {
  seedCatalog({
    races: [
      { id: 'srd_half-orc', name: 'Half-Orc', size: 'Medium', speed: 30 },
      { id: 'srd_half-elf', name: 'Half-Elf', size: 'Medium', speed: 30 },
    ],
    classes: [
      { id: 'srd_fighter', name: 'Fighter', hitDie: 10, primaryAbilities: [], savingThrows: ['STR', 'CON'],
        skillChoices: CLASS_SKILL_CHOICES.srd_fighter,
        casterType: 'NONE', spellCounts: { cantrips: 0, prepared: 0 } },
      { id: 'srd_wizard', name: 'Wizard', hitDie: 6, primaryAbilities: [], savingThrows: ['INT', 'WIS'],
        skillChoices: CLASS_SKILL_CHOICES.srd_wizard,
        casterType: 'FULL', spellCounts: { cantrips: 1, prepared: 1 } },
    ],
    backgrounds: [
      { id: 'srd_acolyte', name: 'Acolyte', skillIds: ['insight', 'religion'], initiateClassNames: [],
        abilityOptions: ['INT', 'WIS', 'CHA'] },
    ],
    spells: [
      { id: 'srd_fire-bolt', name: 'Fire Bolt', level: 0, school: 'Evocation', classIds: ['srd_wizard'],
        desc: '', concentration: false, ritual: false, castingTime: '', range: '', duration: '' },
      { id: 'srd_shield', name: 'Shield', level: 1, school: 'Abjuration', classIds: ['srd_wizard'],
        desc: '', concentration: false, ritual: false, castingTime: '', range: '', duration: '' },
    ],
    equipment: [
      { id: 'srd_longsword', name: 'Longsword', category: 'weapon', desc: 'A versatile blade.' },
      { id: 'srd_chain-mail', name: 'Chain mail', category: 'armor', desc: 'Heavy interlocking rings.' },
      { id: 'srd_rope', name: 'Rope (50 feet)', category: 'gear', desc: 'Hempen rope.' },
    ],
  })
}