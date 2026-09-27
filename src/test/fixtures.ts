import { seedCatalog } from "../data/catalog";
import { CLASS_SKILL_CHOICES } from "../data/classRules";

export function seedTestCatalog(): void {
  seedCatalog({
    races: [
      { id: 'srd_half-orc', name: 'Half-Orc', size: 'Medium', speed: 30, abilityBonuses: { STR: 2, CON: 1 } },
      { id: 'srd_half-elf', name: 'Half-Elf', size: 'Medium', speed: 30, abilityBonuses: { CHA: 2 }, abilityChoice: { count: 2, amount: 1, exclude: ['CHA'] } },
    ],
    classes: [
      { id: 'srd_fighter', name: 'Fighter', hitDie: 10, primaryAbilities: [], savingThrows: ['STR', 'CON'], skillChoices: CLASS_SKILL_CHOICES.srd_fighter },
      { id: 'srd_wizard', name: 'Wizard', hitDie: 6, primaryAbilities: [], savingThrows: ['INT', 'WIS'], skillChoices: CLASS_SKILL_CHOICES.srd_wizard },
    ],
    backgrounds: [
      { id: 'srd_acolyte', name: 'Acolyte', skillIds: ['insight', 'religion'] },
    ],
    items: [
      { id: 'srd_longsword', name: 'Longsword', category: 'weapon', desc: 'A versatile blade.' },
      { id: 'srd_chain-mail', name: 'Chain mail', category: 'armor', desc: 'Heavy interlocking rings.' },
      { id: 'srd_rope', name: 'Rope (50 feet)', category: 'gear', desc: 'Hempen rope.' },
    ],
  })
}