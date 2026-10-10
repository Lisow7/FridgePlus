// Libellés de la fenêtre « Mes listes ».
//
// Extrait de `shopping-lists-modal.jsx` le 2026-10-10 (§2 audit front), quand les
// boutons de confirmation ont reçu leur nom (« Remplacer le panier », « Supprimer la
// liste ») : même pattern que `leftovers-i18n.js` — sortir le dictionnaire est
// l'extraction la plus sûre d'un gros composant, sans dépendance ni état.
//
// Couvert automatiquement par `i18n-dictionaries-parity.test.js`, qui découvre les
// dictionnaires par glob.

export const SHOPPING_LISTS_I18N = {
  fr: {
    title: 'Mes listes',
    counter: '{{n}} / {{max}} listes',
    empty: 'Tu n’as pas encore enregistré de liste.',
    emptyHint: 'Quand tu auras des éléments dans ton panier, clique sur « Enregistrer ma liste ».',
    close: 'Fermer',
    loading: 'Chargement…',
    items: '{{n}} élément(s)',
    updated: 'Modifiée le {{date}}',
    actionLoad: 'Charger',
    actionRename: 'Renommer',
    actionDelete: 'Supprimer',
    confirmReplace: 'Ton panier actuel n\'est pas vide. Le remplacer par cette liste ?',
    confirmReplaceOk: 'Remplacer le panier',
    nameValid: 'OK',
    nameCancel: 'Annuler',
    nameTooLong: '80 caractères max.',
    nameRequired: 'Nom requis.',
    listLoaded: 'Liste chargée dans le panier.',
    listRenamed: 'Liste renommée.',
    listDeleted: 'Liste supprimée',  // pour le toast undo
    deleteFailed: 'Erreur lors de la suppression. Réessaie.',
    confirmDelete: 'Supprimer définitivement la liste « {{name}} » ?\n\nCette action est différente de « Fermer ma liste » dans le panier — ici tu supprimes la liste enregistrée. Tu auras 10 secondes pour annuler.',
    confirmDeleteOk: 'Supprimer la liste',
    ctaStartList: 'Démarrer une nouvelle liste',
  },
  en: {
    title: 'My lists',
    counter: '{{n}} / {{max}} lists',
    empty: 'You haven\'t saved any list yet.',
    emptyHint: 'When you have items in your cart, click “Save my list”.',
    close: 'Close',
    loading: 'Loading…',
    items: '{{n}} item(s)',
    updated: 'Updated {{date}}',
    actionLoad: 'Load',
    actionRename: 'Rename',
    actionDelete: 'Delete',
    confirmReplace: 'Your current cart isn\'t empty. Replace it with this list?',
    confirmReplaceOk: 'Replace the cart',
    nameValid: 'OK',
    nameCancel: 'Cancel',
    nameTooLong: '80 chars max.',
    nameRequired: 'Name required.',
    listLoaded: 'List loaded into the cart.',
    listRenamed: 'List renamed.',
    listDeleted: 'List deleted',
    deleteFailed: 'Error while deleting. Please retry.',
    confirmDelete: 'Permanently delete the list "{{name}}"?\n\nThis is different from "Close my list" in the cart — here you\'re deleting the saved list. You will have 10 seconds to undo.',
    confirmDeleteOk: 'Delete the list',
    ctaStartList: 'Start a new list',
  },
}
