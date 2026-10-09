import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Field from '@shared/ui/field'

// Un champ et son libellé RELIÉS (audit du 2026-10-04, A11Y-07). Le motif
// dominant de l'app était un `<label>` VOISIN du champ, jamais relié : un
// lecteur d'écran annonçait « zone de liste » sans dire laquelle.

describe('Field', () => {
  it('le libellé nomme le champ', () => {
    render(<Field label="Statut"><select><option>Brouillon</option></select></Field>)
    expect(screen.getByLabelText('Statut').tagName).toBe('SELECT')
  })

  it('deux champs, deux identifiants distincts', () => {
    render(<><Field label="Prép."><input /></Field><Field label="Cuisson"><input /></Field></>)
    expect(screen.getByLabelText('Prép.').id).not.toBe(screen.getByLabelText('Cuisson').id)
  })

  it('garde l’identifiant que le champ porte déjà', () => {
    render(<Field label="E-mail"><input id="courriel" /></Field>)
    expect(screen.getByLabelText('E-mail')).toHaveAttribute('id', 'courriel')
  })

  it('l’aide décrit le champ', () => {
    render(<Field label="Groupe parent" hint="ex : fr-oeuf"><input /></Field>)
    expect(screen.getByLabelText('Groupe parent')).toHaveAccessibleDescription('ex : fr-oeuf')
  })

  it('l’erreur est annoncée, marque le champ invalide et le décrit', () => {
    render(<Field label="Temps total" error="Au moins une minute."><input /></Field>)
    const champ = screen.getByLabelText('Temps total')
    expect(champ).toHaveAttribute('aria-invalid', 'true')
    expect(champ).toHaveAccessibleDescription('Au moins une minute.')
    expect(screen.getByRole('alert')).toHaveTextContent('Au moins une minute.')
  })

  it('sans aide ni erreur : ni description, ni « invalide »', () => {
    render(<Field label="Portions"><input /></Field>)
    const champ = screen.getByLabelText('Portions')
    expect(champ).not.toHaveAttribute('aria-describedby')
    expect(champ).not.toHaveAttribute('aria-invalid')
  })

  it('garde la description que le champ porte déjà, et y ajoute la sienne', () => {
    render(<><p id="regle">3 à 20 caractères</p><Field label="Pseudo" hint="Visible des autres"><input aria-describedby="regle" /></Field></>)
    expect(screen.getByLabelText('Pseudo')).toHaveAccessibleDescription('3 à 20 caractères Visible des autres')
  })

  it('les styles passent au libellé et au conteneur', () => {
    const { container } = render(<Field label="Type" labelStyle={{ fontSize: 13 }} style={{ gap: 4 }}><select /></Field>)
    expect(container.firstChild).toHaveStyle({ gap: '4px' })
    expect(screen.getByText('Type')).toHaveStyle({ fontSize: '13px' })
  })
})
