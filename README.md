# 🍽️ Intégral — Menu Digital Premium

Menu digital premium pour le Restaurant Intégral à Cissin. Application web progressive (PWA) avec Firebase Firestore en temps réel.

---

## 🚀 Déploiement sur Vercel via GitHub

### 1. Pousser sur GitHub

```bash
git init
git add .
git commit -m "feat: initial commit — Intégral Menu"
git branch -M main
git remote add origin https://github.com/VOTRE_USERNAME/integral-menu.git
git push -u origin main
```

### 2. Connecter à Vercel

1. Allez sur [vercel.com](https://vercel.com) → **Add New Project**
2. Importez votre repo GitHub `integral-menu`
3. **Framework Preset** → sélectionnez **Other** (site statique)
4. Laissez les paramètres par défaut → **Deploy**

Vercel détecte automatiquement le `vercel.json` et configure tout correctement.

### 3. Domaine personnalisé (optionnel)

Dans Vercel → Settings → Domains → ajoutez votre domaine.

---

## 🔥 Configuration Firebase

Le fichier `index.html` contient la configuration Firebase. Pour un environnement de production sécurisé :

1. Allez sur [Firebase Console](https://console.firebase.google.com)
2. Activez les **règles de sécurité Firestore** adaptées
3. Ajoutez votre domaine Vercel dans Firebase → Authentication → **Domaines autorisés**

### Règles Firestore recommandées

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Menu lisible par tous, modifiable uniquement par admins authentifiés
    match /menu_overrides/{item} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    // Commandes : création publique, lecture admin uniquement
    match /orders/{order} {
      allow create: if true;
      allow read, update, delete: if request.auth != null;
    }
  }
}
```

---

## 📁 Structure du projet

```
integral-menu/
├── index.html        # Application principale (SPA)
├── manifest.json     # Manifest PWA
├── vercel.json       # Configuration Vercel
├── .gitignore        # Fichiers à ignorer
└── README.md         # Ce fichier
```

---

## ✨ Fonctionnalités

- 🗂️ Menu par catégories avec recherche en temps réel
- 🛒 Panier & commande WhatsApp
- 📊 Dashboard admin avec stats commandes
- ✏️ Éditeur de menu (prix, disponibilité, images)
- 🌙 Mode sombre / clair
- 📱 PWA installable sur mobile
- 🔴 Connexion Firebase temps réel
- 🖨️ Impression de reçus
- 📋 Export PDF & QR Code de table
