// payment.js - Gestion des paiements

class PaymentManager {
  constructor() {
    this.apiBaseUrl = 'https://api.savoirplus.bf/payment';
    this.orangeMoneyEnabled = true;
    this.cashEnabled = true;
    this.pendingTransactions = [];
    this.init();
  }

  async init() {
    // Charger les transactions en attente
    await this.loadPendingTransactions();
    
    // Vérifier le statut des paiements en attente
    this.checkPendingPayments();
    
    // Configurer les écouteurs
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Boutons de paiement Orange Money
    document.querySelectorAll('.btn-pay-orange').forEach(btn => {
      btn.addEventListener('click', () => this.initiateOrangePayment(btn.dataset));
    });

    // Boutons de confirmation cash
    document.querySelectorAll('.btn-confirm-cash').forEach(btn => {
      btn.addEventListener('click', () => this.confirmCashPayment(btn.dataset));
    });

    // Formulaire de validation
    const paymentForm = document.getElementById('payment-form');
    if (paymentForm) {
      paymentForm.addEventListener('submit', (e) => {
        e.preventDefault();
        this.processPayment();
      });
    }
  }

  // ==================== ORANGE MONEY ====================

  async initiateOrangePayment(data) {
    try {
      const { amount, userId, package: packageId, description } = data;
      
      // Vérifier la connexion
      if (!navigator.onLine) {
        this.showOfflinePaymentOption(data);
        return;
      }

      // Afficher le loader
      this.showLoader('Initialisation paiement Orange Money...');

      // 1. Créer la transaction sur le serveur
      const response = await fetch(`${this.apiBaseUrl}/orange/initiate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount,
          userId,
          packageId,
          description,
          phone: data.phone || null,
          timestamp: new Date().toISOString()
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Erreur initialisation');
      }

      // 2. Rediriger vers l'interface Orange Money
      this.hideLoader();
      
      // Afficher la modale Orange Money
      this.showOrangeModal({
        transactionId: result.transactionId,
        amount: amount,
        phoneNumber: result.phoneNumber,
        operator: result.operator,
        payToken: result.payToken
      });

    } catch (error) {
      this.hideLoader();
      this.showError('Erreur Orange Money: ' + error.message);
      
      // Proposer solution de repli
      this.showFallbackOptions(data);
    }
  }

  showOrangeModal(data) {
    const modal = document.createElement('div');
    modal.className = 'payment-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>💰 Paiement Orange Money</h3>
          <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="payment-details">
            <p>Montant: <strong>${data.amount} FCFA</strong></p>
            <p>Transaction: ${data.transactionId}</p>
          </div>
          
          <div class="orange-instructions">
            <h4>📱 Sur votre téléphone:</h4>
            <ol>
              <li>Composez <strong>#144#</strong></li>
              <li>Choisissez "Paiement marchand"</li>
              <li>Entrez le code: <strong>${data.payToken}</strong></li>
              <li>Confirmez le paiement de ${data.amount} FCFA</li>
            </ol>
          </div>

          <div class="payment-status">
            <p>En attente de confirmation...</p>
            <div class="loader"></div>
          </div>

          <div class="manual-confirmation">
            <p>Déjà effectué ?</p>
            <button class="btn-confirm-payment" data-transaction="${data.transactionId}">
              J'ai payé
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Gestionnaire confirmation manuelle
    modal.querySelector('.btn-confirm-payment').addEventListener('click', () => {
      this.confirmOrangePayment(data.transactionId);
    });

    // Fermeture
    modal.querySelector('.close-modal').addEventListener('click', () => {
      modal.remove();
      // Sauvegarder pour vérification ultérieure
      this.savePendingTransaction(data);
    });

    // Vérification automatique toutes les 30 secondes
    const checkInterval = setInterval(() => {
      this.checkOrangePaymentStatus(data.transactionId);
    }, 30000);

    // Nettoyer l'intervalle à la fermeture
    modal.querySelector('.close-modal').addEventListener('click', () => {
      clearInterval(checkInterval);
    });
  }

  async confirmOrangePayment(transactionId) {
    try {
      this.showLoader('Vérification du paiement...');

      const response = await fetch(`${this.apiBaseUrl}/orange/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transactionId,
          confirmedAt: new Date().toISOString()
        })
      });

      const result = await response.json();

      if (result.success) {
        this.showSuccess('Paiement confirmé ! Accès débloqué.');
        this.unlockContent(result.packageId);
        this.removePendingTransaction(transactionId);
        
        // Fermer la modale
        document.querySelector('.payment-modal')?.remove();
      } else {
        throw new Error('Paiement non trouvé');
      }
    } catch (error) {
      this.showError('Vérification échouée. Réessayez dans quelques minutes.');
    } finally {
      this.hideLoader();
    }
  }

  async checkOrangePaymentStatus(transactionId) {
    try {
      const response = await fetch(`${this.apiBaseUrl}/orange/status/${transactionId}`);
      const result = await response.json();

      if (result.status === 'completed') {
        this.showSuccess('Paiement reçu !');
        this.unlockContent(result.packageId);
        this.removePendingTransaction(transactionId);
        document.querySelector('.payment-modal')?.remove();
      }
    } catch (error) {
      console.log('Vérification en cours...');
    }
  }

  // ==================== PAIEMENT CASH ====================

  async initiateCashPayment(data) {
    try {
      const { amount, userId, package: packageId } = data;

      // Générer un code unique
      const cashCode = this.generateCashCode();

      // Sauvegarder la demande
      const pendingCash = {
        id: cashCode,
        amount,
        userId,
        packageId,
        status: 'pending',
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString() // 7 jours
      };

      await this.savePendingCash(pendingCash);

      // Afficher les instructions
      this.showCashInstructions(pendingCash);

      // Envoyer au dépositaire le plus proche
      if (navigator.onLine) {
        this.notifyNearestAgent(pendingCash);
      }

    } catch (error) {
      this.showError('Erreur initialisation paiement cash');
    }
  }

  showCashInstructions(pendingCash) {
    const modal = document.createElement('div');
    modal.className = 'payment-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>💰 Paiement en espèces</h3>
          <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
          <div class="cash-code">
            <p>Votre code de paiement:</p>
            <div class="big-code">${pendingCash.id}</div>
          </div>

          <div class="cash-instructions">
            <h4>📍 Où payer ?</h4>
            <div id="nearest-agents">
              <div class="loader"></div>
            </div>

            <h4>📝 Comment payer ?</h4>
            <ol>
              <li>Rendez-vous chez un dépositaire agréé</li>
              <li>Donnez votre code: <strong>${pendingCash.id}</strong></li>
              <li>Payez ${pendingCash.amount} FCFA</li>
              <li>Gardez le reçu</li>
            </ol>
          </div>

          <div class="cash-warning">
            <p>⚠️ Ce code expire le ${new Date(pendingCash.expiresAt).toLocaleDateString()}</p>
          </div>

          <button class="btn-send-sms" data-code="${pendingCash.id}">
            📲 Recevoir le code par SMS
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Charger les agents proches
    this.loadNearestAgents();

    // Envoyer par SMS
    modal.querySelector('.btn-send-sms').addEventListener('click', () => {
      this.sendCodeBySMS(pendingCash.id);
    });

    modal.querySelector('.close-modal').addEventListener('click', () => {
      modal.remove();
    });
  }

  async confirmCashPayment(data) {
    try {
      const { cashCode, agentId } = data;

      // Vérifier le code
      const pendingCash = await this.getPendingCash(cashCode);

      if (!pendingCash) {
        throw new Error('Code invalide');
      }

      if (new Date(pendingCash.expiresAt) < new Date()) {
        throw new Error('Code expiré');
      }

      // Confirmer le paiement
      const response = await fetch(`${this.apiBaseUrl}/cash/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cashCode,
          agentId,
          confirmedAt: new Date().toISOString()
        })
      });

      const result = await response.json();

      if (result.success) {
        this.showSuccess('Paiement cash confirmé !');
        this.unlockContent(result.packageId);
        this.removePendingCash(cashCode);
        
        // Notifier l'utilisateur par SMS
        this.sendPaymentConfirmationSMS(result.userPhone);
      }

    } catch (error) {
      this.showError('Erreur confirmation: ' + error.message);
    }
  }

  // ==================== GESTION BASE DE DONNÉES LOCALE ====================

  async savePendingTransaction(transaction) {
    try {
      const db = await this.openDB();
      const tx = db.transaction('pendingPayments', 'readwrite');
      const store = tx.objectStore('pendingPayments');
      
      await store.add({
        ...transaction,
        synced: false,
        lastAttempt: new Date().toISOString()
      });
      
      console.log('Transaction en attente sauvegardée');
    } catch (error) {
      console.error('Erreur sauvegarde transaction:', error);
    }
  }

  async loadPendingTransactions() {
    try {
      const db = await this.openDB();
      const tx = db.transaction('pendingPayments', 'readonly');
      const store = tx.objectStore('pendingPayments');
      
      this.pendingTransactions = await store.getAll();
      
      return this.pendingTransactions;
    } catch (error) {
      console.error('Erreur chargement transactions:', error);
      return [];
    }
  }

  async removePendingTransaction(transactionId) {
    try {
      const db = await this.openDB();
      const tx = db.transaction('pendingPayments', 'readwrite');
      const store = tx.objectStore('pendingPayments');
      
      await store.delete(transactionId);
      
      this.pendingTransactions = this.pendingTransactions.filter(
        t => t.id !== transactionId
      );
    } catch (error) {
      console.error('Erreur suppression transaction:', error);
    }
  }

  // ==================== UTILITAIRES ====================

  generateCashCode() {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
      if (i === 3) code += '-';
    }
    return code;
  }

  async openDB() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open('SavoirPlusDB', 2);
      
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      
      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        
        if (!db.objectStoreNames.contains('pendingPayments')) {
          db.createObjectStore('pendingPayments', { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains('pendingCash')) {
          db.createObjectStore('pendingCash', { keyPath: 'id' });
        }
        
        if (!db.objectStoreNames.contains('userProgress')) {
          db.createObjectStore('userProgress', { keyPath: 'id' });
        }
      };
    });
  }

  showLoader(message = 'Chargement...') {
    let loader = document.getElementById('global-loader');
    if (!loader) {
      loader = document.createElement('div');
      loader.id = 'global-loader';
      loader.className = 'global-loader';
      document.body.appendChild(loader);
    }
    loader.innerHTML = `
      <div class="loader-content">
        <div class="spinner"></div>
        <p>${message}</p>
      </div>
    `;
    loader.classList.remove('hidden');
  }

  hideLoader() {
    const loader = document.getElementById('global-loader');
    if (loader) {
      loader.classList.add('hidden');
    }
  }

  showError(message) {
    this.showNotification(message, 'error');
  }

  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
      notification.classList.add('fade-out');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  showOfflinePaymentOption(data) {
    const modal = document.createElement('div');
    modal.className = 'payment-modal';
    modal.innerHTML = `
      <div class="modal-content">
        <div class="modal-header">
          <h3>📶 Mode hors-ligne</h3>
          <button class="close-modal">&times;</button>
        </div>
        <div class="modal-body">
          <p>Connexion internet faible ou absente.</p>
          
          <div class="offline-options">
            <button class="btn-pay-later" onclick="paymentManager.saveForLater(${JSON.stringify(data)})">
              ⏳ Payer plus tard
            </button>
            
            <button class="btn-pay-cash" onclick="paymentManager.initiateCashPayment(${JSON.stringify(data)})">
              💵 Payer en espèces
            </button>
            
            <button class="btn-retry" onclick="window.location.reload()">
              🔄 Réessayer
            </button>
          </div>
        </div>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    modal.querySelector('.close-modal').addEventListener('click', () => {
      modal.remove();
    });
  }

  // Synchronisation des paiements hors-ligne
  async syncPendingPayments() {
    if (!navigator.onLine) return;

    const pending = await this.loadPendingTransactions();
    
    for (const transaction of pending) {
      try {
        if (transaction.type === 'orange') {
          await this.checkOrangePaymentStatus(transaction.id);
        } else if (transaction.type === 'cash') {
          await this.confirmCashPayment({
            cashCode: transaction.id,
            agentId: transaction.agentId
          });
        }
      } catch (error) {
        console.log('Sync échoué pour:', transaction.id);
      }
    }
  }
}

// Initialisation
const paymentManager = new PaymentManager();

// Exposer globalement pour les callbacks HTML
window.paymentManager = paymentManager;

// Écouter les changements de connexion
window.addEventListener('online', () => {
  console.log('Connexion rétablie - synchronisation paiements');
  paymentManager.syncPendingPayments();
});