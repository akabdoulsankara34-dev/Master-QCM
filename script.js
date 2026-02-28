// ============================================
// MAËLYS MARKET & TONTINE - GESTION CRÉANCIERS
// Version avec calcul automatique et stockage avancé
// ============================================

// Initialisation avec structure de données améliorée
let creanciers = [];
let historiqueModifications = [];

// Chargement des données au démarrage
function chargerDonnees() {
    try {
        // Charger les créanciers
        const savedData = localStorage.getItem('maelys_creanciers');
        if (savedData) {
            creanciers = JSON.parse(savedData);
        }
        
        // Charger l'historique
        const savedHistory = localStorage.getItem('maelys_historique');
        if (savedHistory) {
            historiqueModifications = JSON.parse(savedHistory);
        }
        
        // Vérifier et migrer les anciennes données si nécessaire
        migrerAnciennesDonnees();
        
    } catch (error) {
        console.error('Erreur chargement données:', error);
        creanciers = [];
        historiqueModifications = [];
    }
}

// Migration des anciennes données vers le nouveau format
function migrerAnciennesDonnees() {
    let migrationNecessaire = false;
    
    creanciers = creanciers.map(c => {
        // Si c'est l'ancien format (avec 'reste' mais sans 'verse')
        if (c.reste !== undefined && c.verse === undefined) {
            migrationNecessaire = true;
            return {
                ...c,
                verse: c.montant - c.reste,
                dateCreation: c.dateCreation || new Date().toISOString(),
                dateModification: new Date().toISOString()
            };
        }
        return c;
    });
    
    if (migrationNecessaire) {
        sauvegarderDonnees();
    }
}

// Sauvegarde complète des données
function sauvegarderDonnees() {
    try {
        localStorage.setItem('maelys_creanciers', JSON.stringify(creanciers));
        localStorage.setItem('maelys_historique', JSON.stringify(historiqueModifications));
        localStorage.setItem('maelys_last_update', new Date().toISOString());
        return true;
    } catch (error) {
        console.error('Erreur sauvegarde:', error);
        alert('⚠️ Erreur lors de la sauvegarde. Vérifiez l\'espace disponible.');
        return false;
    }
}

// Calcul automatique du reste à solder
function calculerResteAuto() {
    const montant = parseFloat(document.getElementById('montant').value) || 0;
    const verse = parseFloat(document.getElementById('verse').value) || 0;
    const reste = montant - verse;
    
    document.getElementById('reste').value = reste >= 0 ? reste : 0;
    
    // Changer la couleur si négatif
    const resteField = document.getElementById('reste');
    if (reste < 0) {
        resteField.style.color = '#dc3545';
        resteField.style.fontWeight = 'bold';
    } else {
        resteField.style.color = '';
        resteField.style.fontWeight = '';
    }
}

// Générer le message WhatsApp
function generateMessage(creancier) {
    const pourcentagePaye = ((creancier.verse / creancier.montant) * 100).toFixed(1);
    
    return `*MAËLYS MARKET & TONTINE - RAPPEL DE PAIEMENT*

Bonjour *${creancier.nom}*,

📝 *Motif du crédit* : ${creancier.motif}
💰 *Montant total* : ${creancier.montant.toLocaleString()} FCFA
💵 *Montant versé* : ${creancier.verse.toLocaleString()} FCFA (${pourcentagePaye}%)
⏳ *Reste à payer* : ${creancier.reste.toLocaleString()} FCFA

📌 *Numéro de dépôt* : 75523259

Merci d'avoir fait confiance à Maëlys Market et Tontine.

_Cliquez sur ce message pour payer ou contactez-nous pour plus d'informations._`;
}

// Envoyer sur WhatsApp
function sendWhatsApp(numero, message) {
    // Nettoyer le numéro
    let cleanNumero = numero.replace(/\s+/g, '').replace(/[+]/g, '');
    if (!cleanNumero.startsWith('221')) {
        cleanNumero = '221' + cleanNumero;
    }
    
    let whatsappUrl = `https://wa.me/${cleanNumero}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
    
    // Enregistrer l'action dans l'historique
    enregistrerAction('ENVOI_RAPPEL', { numero: cleanNumero });
}

// Afficher les créanciers
function displayCreanciers(filteredCreanciers = null) {
    const tableBody = document.getElementById('tableBody');
    const dataToShow = filteredCreanciers || creanciers;
    
    if (!dataToShow || dataToShow.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px;">
            <div style="font-size: 1.2em; color: #666;">📭 Aucun créancier enregistré</div>
            <div style="margin-top: 10px; color: #999;">Utilisez le formulaire ci-dessus pour ajouter un créancier</div>
        </td></tr>`;
        updateStats();
        return;
    }
    
    // Trier par date (plus récent d'abord)
    const sortedData = [...dataToShow].sort((a, b) => {
        return new Date(b.dateModification || b.dateCreation || 0) - new Date(a.dateCreation || 0);
    });
    
    tableBody.innerHTML = sortedData.map((c, index) => {
        const pourcentagePaye = ((c.verse / c.montant) * 100).toFixed(1);
        const dateCreation = c.dateCreation ? new Date(c.dateCreation).toLocaleDateString('fr-FR') : 'N/A';
        
        return `
        <tr>
            <td>
                <strong>${c.nom}</strong><br>
                <small style="color: #999;">${dateCreation}</small>
            </td>
            <td>${c.montant.toLocaleString()} FCFA</td>
            <td class="${c.reste > 0 ? 'status-impaye' : 'status-solde'}">
                <strong>${c.reste.toLocaleString()} FCFA</strong>
            </td>
            <td>${c.verse.toLocaleString()} FCFA<br>
                <small style="color: #666;">${pourcentagePaye}% payé</small>
            </td>
            <td class="motif-credit">${c.motif}</td>
            <td>${c.whatsapp}</td>
            <td>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${pourcentagePaye}%"></div>
                </div>
            </td>
            <td>
                <div class="actions">
                    <button class="btn-small btn-success" onclick="sendRappel('${index}')" title="Envoyer rappel WhatsApp">
                        📱 Rappel
                    </button>
                    <button class="btn-small btn-warning" onclick="openEditModal('${index}')" title="Modifier">
                        ✏️ Modif
                    </button>
                    <button class="btn-small btn-primary" onclick="effectuerPaiement('${index}')" title="Enregistrer un paiement">
                        💵 Paiement
                    </button>
                    <button class="btn-small btn-danger" onclick="deleteCreancier('${index}')" title="Supprimer">
                        🗑️ Suppr
                    </button>
                </div>
            </td>
        </tr>
    `}).join('');
    
    updateStats();
}

// Ajouter une barre de progression dans le CSS
const style = document.createElement('style');
style.textContent = `
    .progress-bar {
        width: 100px;
        height: 8px;
        background: #e0e0e0;
        border-radius: 4px;
        overflow: hidden;
    }
    .progress-fill {
        height: 100%;
        background: linear-gradient(90deg, #28a745, #20c997);
        transition: width 0.3s ease;
    }
    .calculated-field {
        background: #f8f9fa;
        font-weight: bold;
        color: #28a745;
    }
`;
document.head.appendChild(style);

// Enregistrer une action dans l'historique
function enregistrerAction(type, details) {
    const action = {
        type: type,
        details: details,
        date: new Date().toISOString(),
        utilisateur: 'Maëlys Market'
    };
    
    historiqueModifications.push(action);
    
    // Garder seulement les 100 dernières actions
    if (historiqueModifications.length > 100) {
        historiqueModifications = historiqueModifications.slice(-100);
    }
    
    sauvegarderDonnees();
}

// Ajouter un créancier
document.getElementById('creancierForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const montant = parseFloat(document.getElementById('montant').value);
    const verse = parseFloat(document.getElementById('verse').value) || 0;
    
    // Validation
    if (verse > montant) {
        if (!confirm('⚠️ Le montant versé dépasse le montant total. Voulez-vous continuer ?')) {
            return;
        }
    }
    
    const reste = montant - verse;
    
    const newCreancier = {
        id: 'CRED-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9),
        nom: document.getElementById('nom').value,
        montant: montant,
        verse: verse,
        reste: reste >= 0 ? reste : 0,
        whatsapp: document.getElementById('whatsapp').value,
        motif: document.getElementById('motif').value,
        dateCreation: new Date().toISOString(),
        dateModification: new Date().toISOString(),
        statut: reste <= 0 ? 'SOLDE' : 'EN_COURS',
        notificationsEnvoyees: 0
    };
    
    creanciers.push(newCreancier);
    enregistrerAction('AJOUT', { nom: newCreancier.nom, montant: montant });
    
    if (sauvegarderDonnees()) {
        this.reset();
        document.getElementById('verse').value = '0';
        document.getElementById('reste').value = '0';
        displayCreanciers();
        
        showNotification('✅ Créancier ajouté avec succès !', 'success');
    }
});

// Afficher une notification
function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 15px 25px;
        background: ${type === 'success' ? '#28a745' : '#17a2b8'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        animation: slideIn 0.3s ease;
    `;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

// Envoyer un rappel
function sendRappel(index) {
    const creancier = creanciers[index];
    if (creancier.reste <= 0) {
        if (!confirm(`ℹ️ Ce créancier a déjà soldé sa dette. Envoyer quand même un rappel ?`)) {
            return;
        }
    }
    
    if (confirm(`Envoyer un rappel WhatsApp à ${creancier.nom} ?`)) {
        const message = generateMessage(creancier);
        sendWhatsApp(creancier.whatsapp, message);
        
        // Mettre à jour le compteur
        creancier.notificationsEnvoyees = (creancier.notificationsEnvoyees || 0) + 1;
        sauvegarderDonnees();
    }
}

// Effectuer un paiement
function effectuerPaiement(index) {
    const creancier = creanciers[index];
    
    const montantPaiement = prompt(
        `💰 Montant du paiement pour ${creancier.nom}\n` +
        `Reste actuel : ${creancier.reste.toLocaleString()} FCFA\n\n` +
        `Entrez le montant à payer :`,
        creancier.reste
    );
    
    if (montantPaiement === null) return;
    
    const paiement = parseFloat(montantPaiement);
    if (isNaN(paiement) || paiement <= 0) {
        alert('❌ Montant invalide');
        return;
    }
    
    const nouveauVerse = creancier.verse + paiement;
    const nouveauReste = creancier.montant - nouveauVerse;
    
    creancier.verse = nouveauVerse;
    creancier.reste = nouveauReste >= 0 ? nouveauReste : 0;
    creancier.dateModification = new Date().toISOString();
    creancier.statut = creancier.reste <= 0 ? 'SOLDE' : 'EN_COURS';
    
    enregistrerAction('PAIEMENT', { 
        nom: creancier.nom, 
        montant: paiement,
        nouveauReste: creancier.reste 
    });
    
    if (sauvegarderDonnees()) {
        displayCreanciers();
        showNotification(`✅ Paiement de ${paiement.toLocaleString()} FCFA enregistré !`, 'success');
    }
}

// Supprimer un créancier
function deleteCreancier(index) {
    const creancier = creanciers[index];
    
    if (creancier.reste > 0) {
        if (!confirm(`⚠️ Ce créancier a encore ${creancier.reste.toLocaleString()} FCFA à payer.\nVoulez-vous vraiment le supprimer ?`)) {
            return;
        }
    } else {
        if (!confirm(`Êtes-vous sûr de vouloir supprimer ${creancier.nom} de la liste ?`)) {
            return;
        }
    }
    
    enregistrerAction('SUPPRESSION', { nom: creancier.nom });
    creanciers.splice(index, 1);
    
    if (sauvegarderDonnees()) {
        displayCreanciers();
        showNotification('🗑️ Créancier supprimé', 'info');
    }
}

// Mettre à jour les statistiques
function updateStats() {
    const totalCreanciers = creanciers.length;
    const totalMontant = creanciers.reduce((sum, c) => sum + c.montant, 0);
    const totalReste = creanciers.reduce((sum, c) => sum + c.reste, 0);
    const totalVerse = creanciers.reduce((sum, c) => sum + c.verse, 0);
    
    const creanciersSolde = creanciers.filter(c => c.reste <= 0).length;
    const creanciersActifs = creanciers.filter(c => c.reste > 0).length;
    
    const statsHTML = `
        <div class="stat-card">
            <h3>📊 Total créanciers</h3>
            <p>${totalCreanciers}</p>
            <small>${creanciersSolde} soldés / ${creanciersActifs} actifs</small>
        </div>
        <div class="stat-card">
            <h3>💰 Montant total</h3>
            <p>${totalMontant.toLocaleString()} FCFA</p>
        </div>
        <div class="stat-card">
            <h3>⏳ Reste à solder</h3>
            <p>${totalReste.toLocaleString()} FCFA</p>
            <small>${((totalReste/totalMontant)*100).toFixed(1)}% du total</small>
        </div>
        <div class="stat-card">
            <h3>✅ Déjà payé</h3>
            <p>${totalVerse.toLocaleString()} FCFA</p>
            <small>${((totalVerse/totalMontant)*100).toFixed(1)}% du total</small>
        </div>
    `;
    
    document.getElementById('stats').innerHTML = statsHTML;
}

// Export des données
function exportData() {
    const exportData = {
        creanciers: creanciers,
        historique: historiqueModifications,
        dateExport: new Date().toISOString(),
        version: '2.0',
        depot: '75523259'
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `maelys_creanciers_${new Date().toISOString().slice(0,10)}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    showNotification('📥 Données exportées avec succès !', 'success');
}

// Import des données
function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    
    input.onchange = function(e) {
        const file = e.target.files[0];
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                const imported = JSON.parse(e.target.result);
                
                if (imported.creanciers && Array.isArray(imported.creanciers)) {
                    if (confirm(`Importer ${imported.creanciers.length} créanciers ?`)) {
                        creanciers = imported.creanciers;
                        historiqueModifications = imported.historique || [];
                        sauvegarderDonnees();
                        displayCreanciers();
                        showNotification('✅ Données importées avec succès !', 'success');
                    }
                } else {
                    alert('❌ Format de fichier invalide');
                }
            } catch (error) {
                alert('❌ Erreur lors de l\'import');
            }
        };
        
        reader.readAsText(file);
    };
    
    input.click();
}

// Initialisation
chargerDonnees();
displayCreanciers();

// Ajout des boutons d'export/import
setTimeout(() => {
    const statsDiv = document.getElementById('stats');
    const actionBar = document.createElement('div');
    actionBar.style.cssText = 'display: flex; gap: 10px; justify-content: center; margin-top: 20px; flex-wrap: wrap;';
    
    actionBar.innerHTML = `
        <button class="btn btn-success" onclick="exportData()">📥 Exporter</button>
        <button class="btn btn-primary" onclick="importData()">📤 Importer</button>
        <button class="btn btn-info" onclick="afficherHistorique()">📋 Historique</button>
        <button class="btn btn-warning" onclick="reinitialiserTout()">🔄 Réinitialiser</button>
    `;
    
    statsDiv.appendChild(actionBar);
}, 100);

// Afficher l'historique
function afficherHistorique() {
    const historiqueStr = historiqueModifications
        .slice(-10)
        .reverse()
        .map(a => `[${new Date(a.date).toLocaleString()}] ${a.type}: ${JSON.stringify(a.details)}`)
        .join('\n');
    
    alert('📋 Dernières actions :\n\n' + (historiqueStr || 'Aucun historique'));
}

// Réinitialiser tout
function reinitialiserTout() {
    if (confirm('⚠️ Êtes-vous sûr de vouloir réinitialiser toutes les données ?\nCette action est irréversible !')) {
        creanciers = [];
        historiqueModifications = [];
        sauvegarderDonnees();
        displayCreanciers();
        showNotification('🔄 Données réinitialisées', 'info');
    }
}