import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Markdown } from "../components/Markdown";

describe('Markdown lists', () => {
  it('starts a list straight under its lead-in line, the way class features write them', () => {
    render(<Markdown source={'Keep raging by doing one of the following:\n- Make an attack roll.\n- Force a saving throw.'} />)

    expect(screen.getByText('Keep raging by doing one of the following:').tagName).toBe('P')
    expect(screen.getAllByRole('listitem').map((item) => item.textContent)).toEqual([
      'Make an attack roll.',
      'Force a saving throw.',
    ])
  })

  it('reads an asterisk as a bullet, the way conditions write them', () => {
    const { container } = render(<Markdown source={'While Charmed:\n* Can’t Harm the Charmer.\n* Social Advantage.'} />)

    expect(screen.getAllByRole('listitem')).toHaveLength(2)
    // Read as inline markup, the two asterisks italicised everything between them.
    expect(container.querySelector('em')).toBeNull()
  })

  it('leaves a line that opens in bold as a paragraph', () => {
    render(<Markdown source={'**Drop.** The target drops whatever it is holding.'} />)

    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(screen.getByText('Drop.').tagName).toBe('STRONG')
  })
})
