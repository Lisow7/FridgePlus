// Le message « Pas enregistré » — rendu par `useSaveErrorToast`
// (shared/hooks/use-save-error-toast.js), qui porte les textes et la règle.
export default function SaveErrorToast({ message }) {
  return (
    <div style={{
      maxWidth: 'min(420px, calc(100vw - 32px))', padding: '12px 16px', borderRadius: '12px',
      background: '#B91C1C', color: 'white', fontSize: '14px', fontWeight: 600, lineHeight: 1.4,
      boxShadow: '0 6px 18px rgba(0,0,0,0.22)',
    }}>
      {message}
    </div>
  )
}
