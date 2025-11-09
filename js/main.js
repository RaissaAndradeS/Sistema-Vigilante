firebase.initializeApp({
    apiKey: "AIzaSyCjukYZ483MuTh77jRsO-PmzCRw_RNebYM",
    authDomain: "sistema-vigilantes.firebaseapp.com",
    projectId: "sistema-vigilantes",
    storageBucket: "sistema-vigilantes.firebasestorage.app",
    messagingSenderId: "721178326261",
    appId: "1:721178326261:web:cfdd249d3e8bd8f39601bc"
});

const db = firebase.firestore();

let isAdmin = false;
let plantoes = [];
let folgas = [];
let config = {
    escalaConfig: { tipo: '', mes: '', ano: '' },
    datasManual: [],
    folgasHabilitadas: false,
    feriados: []
};

const postosConfig = {
    1: [{ nome: 'Garagem Privativa - Raio X', vagas: 1 }, { nome: 'Garagem Oficial - Cone', vagas: 1 }, { nome: 'Salão Negro - Elevador', vagas: 2 }, { nome: 'Dinarte Mariz', vagas: 1 }, { nome: 'Salão Negro - Raio X', vagas: 4 }, { nome: 'Guarita N3', vagas: 1 }, { nome: 'Intrajornada (GDER=D/E=CM3)', vagas: 1 }],
    2: [{ nome: 'Garagem Privativa - Raio X', vagas: 1 }, { nome: 'Garagem Oficial - Cone', vagas: 1 }, { nome: 'Salão Negro - Elevador', vagas: 2 }, { nome: 'Dinarte Mariz', vagas: 1 }, { nome: 'Ala Alexandre Costa', vagas: 1 }, { nome: 'Bloco B', vagas: 2 }, { nome: 'Anexo 1', vagas: 1 }, { nome: 'Guarita N3', vagas: 1 }, { nome: 'Intrajornada (GDER=D/E=CM3)', vagas: 1 }],
    3: [{ nome: 'Garagem Privativa - Raio X', vagas: 1 }, { nome: 'Garagem Oficial - Cone', vagas: 1 }, { nome: 'Salão Negro - Elevador', vagas: 2 }, { nome: 'Dinarte Mariz', vagas: 1 }, { nome: 'Ala Alexandre Costa', vagas: 1 }, { nome: 'Bloco B', vagas: 2 }, { nome: 'Anexo 1', vagas: 1 }, { nome: 'Guarita N3', vagas: 1 }, { nome: 'Intrajornada (GDER=D/E=CM3)', vagas: 1 }],
    4: [{ nome: 'Garagem Privativa - Raio X', vagas: 1 }, { nome: 'Garagem Oficial - Cone', vagas: 1 }, { nome: 'Salão Negro - Elevador', vagas: 2 }, { nome: 'Dinarte Mariz', vagas: 1 }, { nome: 'Ala Alexandre Costa', vagas: 1 }, { nome: 'Bloco B', vagas: 2 }, { nome: 'Anexo 1', vagas: 1 }, { nome: 'Chapelaria', vagas: 3 }, { nome: 'Guarita N3', vagas: 1 }, { nome: 'Intrajornada (GDER=D/E=CM3)', vagas: 1 }],
    5: [{ nome: 'Garagem Privativa - Raio X', vagas: 1 }, { nome: 'Garagem Oficial - Cone', vagas: 1 }, { nome: 'Salão Negro - Elevador', vagas: 2 }, { nome: 'Dinarte Mariz', vagas: 1 }, { nome: 'Salão Negro - Raio X', vagas: 4 }, { nome: 'Guarita N3', vagas: 1 }, { nome: 'Intrajornada (GDER=D/E=CM3)', vagas: 1 }]
};

// UTILITIES
function isFimDeSemana(dataStr) {
    const data = new Date(dataStr + 'T00:00:00');
    return data.getDay() === 0 || data.getDay() === 6;
}

function formatarData(dataStr) {
    const data = new Date(dataStr + 'T00:00:00');
    return data.toLocaleDateString('pt-BR');
}

function isFeriado(dataStr) {
    return config.feriados.includes(dataStr);
}

function isFimDeSemanaOuFeriado(dataStr) {
    return isFimDeSemana(dataStr) || isFeriado(dataStr);
}

function getPostosDisponiveis(dataStr) {
    const data = new Date(dataStr + 'T00:00:00');
    const diaSemana = data.getDay();
    if (isFimDeSemana(dataStr)) return [];
    return postosConfig[diaSemana] || [];
}

function getVagasDisponiveis(dataStr, nomePosto) {
    const postosData = getPostosDisponiveis(dataStr);
    const posto = postosData.find(p => p.nome === nomePosto);
    if (!posto) return 0;
    const ocupadas = plantoes.filter(p => p.data === dataStr && p.posto === nomePosto).length;
    return posto.vagas - ocupadas;
}

function validarEscala(dataStr) {
    if (config.datasManual && config.datasManual.length > 0) {
        if (!config.datasManual.find(d => d === dataStr)) return { valido: false, mensagem: 'Data não está na escala manual!' };
        return { valido: true, mensagem: '' };
    }
    if (!config.escalaConfig || !config.escalaConfig.tipo) return { valido: false, mensagem: 'Escala não configurada!' };
    const data = new Date(dataStr + 'T00:00:00');
    const dia = data.getDate();
    const mes = data.getMonth() + 1;
    const ano = data.getFullYear();
    if (parseInt(mes) !== parseInt(config.escalaConfig.mes) || parseInt(ano) !== parseInt(config.escalaConfig.ano)) {
        return { valido: false, mensagem: `Escala para outro período!` };
    }
    const ehPar = dia % 2 === 0;
    if (config.escalaConfig.tipo === 'par' && !ehPar) return { valido: false, mensagem: `Dias PARES!` };
    if (config.escalaConfig.tipo === 'impar' && ehPar) return { valido: false, mensagem: `Dias ÍMPARES!` };
    return { valido: true, mensagem: '' };
}

// TABS
function changeTab(tabName, button) {
    document.querySelectorAll('.card').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabName).classList.add('active');
    if (button) button.classList.add('active');
}

// UI UPDATES
function updatePostos() {
    const data = document.getElementById('plantaoData').value;
    const alertFim = document.getElementById('alertFimSemana');
    const postoGroup = document.getElementById('postoGroup');
    const selectPosto = document.getElementById('plantaoPosto');
    
    if (!data) { alertFim.style.display = 'none'; postoGroup.style.display = 'none'; return; }
    if (isFimDeSemana(data)) { alertFim.textContent = '⚠️ Plantões não permitidos em finais de semana'; alertFim.style.display = 'block'; postoGroup.style.display = 'none'; return; }
    
    const validacao = validarEscala(data);
    if (!validacao.valido) { alertFim.textContent = '⚠️ ' + validacao.mensagem; alertFim.style.display = 'block'; postoGroup.style.display = 'none'; return; }
    
    alertFim.style.display = 'none'; postoGroup.style.display = 'block';
    const postos = getPostosDisponiveis(data);
    selectPosto.innerHTML = '<option value="">Selecione um posto</option>';
    postos.forEach(posto => {
        const vagasDisp = getVagasDisponiveis(data, posto.nome);
        const option = document.createElement('option');
        option.value = posto.nome;
        option.textContent = `${posto.nome} - ${vagasDisp}/${posto.vagas} vagas`;
        option.disabled = vagasDisp <= 0;
        selectPosto.appendChild(option);
    });
}

function atualizarResumoPlantoes() {
    const resumo = document.getElementById('resumoPlantoes');
    if (plantoes.length === 0) {
        resumo.innerHTML = '<p class="text-small" style="color: #6b7280;">Nenhum plantão cadastrado ainda.</p>';
        return;
    }
    let html = '<div>';
    plantoes.forEach((p, idx) => {
        html += `<div class="resumo-item"><div><strong>#${idx + 1}</strong> ${p.matricula} - ${p.nome}</div><div style="text-align: right;"><strong>${formatarData(p.data)}</strong><br><span class="text-small">${p.posto}</span></div></div>`;
    });
    html += `</div><p class="text-small" style="margin-top: 1rem; color: #059669;"><strong>✓ Total: ${plantoes.length}</strong></p>`;
    resumo.innerHTML = html;
}

function atualizarTabelas() {
    const tabelaPlantoes = document.getElementById('tabelaPlantoes');
    document.getElementById('totalPlantoes').textContent = plantoes.length;
    tabelaPlantoes.innerHTML = '';
    if (plantoes.length === 0) {
        tabelaPlantoes.innerHTML = `<tr><td colspan="${isAdmin ? 6 : 5}">Nenhum plantão cadastrado.</td></tr>`;
    } else {
        plantoes.forEach((p, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${idx + 1}</td><td>${p.matricula}</td><td>${p.nome}</td><td>${formatarData(p.data)}</td><td>${p.posto}</td>` + (isAdmin ? `<td><button class="btn btn-danger btn-small" onclick="removerPlantao('${p.id}')">✗ Remover</button></td>` : '');
            tabelaPlantoes.appendChild(tr);
        });
    }
    
    const tabelaFolgas = document.getElementById('tabelaFolgas');
    document.getElementById('totalFolgas').textContent = folgas.length;
    tabelaFolgas.innerHTML = '';
    if (folgas.length === 0) {
        tabelaFolgas.innerHTML = `<tr><td colspan="${isAdmin ? 6 : 5}">Nenhuma folga solicitada.</td></tr>`;
    } else {
        folgas.forEach((f, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `<td>${idx + 1}</td><td>${f.matricula}</td><td>${f.nome}</td><td>${f.equipe}</td><td>${formatarData(f.data)}</td>` + (isAdmin ? `<td><button class="btn btn-danger btn-small" onclick="removerFolga('${f.id}')">✗ Remover</button></td>` : '');
            tabelaFolgas.appendChild(tr);
        });
    }
    
    document.getElementById('acoesPlantaoHeader').style.display = isAdmin ? 'table-cell' : 'none';
    document.getElementById('acoesFolgaHeader').style.display = isAdmin ? 'table-cell' : 'none';
    document.getElementById('adminNotice').style.display = isAdmin ? 'block' : 'none';
}

function atualizarFolgas() {
    const interna = folgas.filter(f => f.equipe === 'Interna').length;
    const externa = folgas.filter(f => f.equipe === 'Externa').length;
    document.getElementById('folgasInterna').textContent = interna;
    document.getElementById('folgasExterna').textContent = externa;
}

function checkFimSemanaFolga() {
    const data = document.getElementById('folgaData').value;
    const equipe = document.getElementById('folgaEquipe').value;
    const alertErro = document.getElementById('alertFolgaData');
    const vagasInfo = document.getElementById('vagasDataInfo');
    const btnFolga = document.getElementById('btnFolga');
    
    if (!data) { alertErro.style.display = 'none'; vagasInfo.style.display = 'none'; btnFolga.disabled = true; return; }
    if (!isFimDeSemanaOuFeriado(data)) { alertErro.textContent = '⚠️ Apenas fins de semana ou feriados'; alertErro.style.display = 'block'; vagasInfo.style.display = 'none'; btnFolga.disabled = true; return; }
    alertErro.style.display = 'none';
    
    if (equipe) {
        const folgasNaData = folgas.filter(f => f.equipe === equipe && f.data === data);
        const vagasRestantes = 8 - folgasNaData.length;
        vagasInfo.style.display = 'block';
        vagasInfo.style.color = vagasRestantes > 0 ? '#059669' : '#ef4444';
        vagasInfo.textContent = vagasRestantes > 0 ? `✓ ${vagasRestantes}/8 vagas` : `✗ Limite atingido`;
        btnFolga.disabled = vagasRestantes <= 0;
    } else {
        btnFolga.disabled = true;
    }
}

function atualizarEscala() {
    const alertEscala = document.getElementById('alertEscala');
    const escalaConfigurada = document.getElementById('escalaConfigurada');
    const escalaInfoCadastro = document.getElementById('escalaInfoCadastro');
    const escalaInfoCadastroText = document.getElementById('escalaInfoCadastroText');

    if (config.escalaConfig.tipo) {
        const meses = ['', 'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
        const infoText = `Dias ${config.escalaConfig.tipo} - ${meses[parseInt(config.escalaConfig.mes)]}/${config.escalaConfig.ano}`;
        document.getElementById('escalaInfo').textContent = infoText;
        escalaInfoCadastroText.textContent = infoText;
        alertEscala.style.display = 'none';
        escalaConfigurada.style.display = 'block';
        escalaInfoCadastro.style.display = 'block';
    } else {
        alertEscala.style.display = 'block';
        escalaConfigurada.style.display = 'none';
        escalaInfoCadastro.style.display = 'none';
    }
}

function atualizarFolgasStatus() {
    const btnToggle = document.getElementById('btnToggleFolgas');
    const statusFolgas = document.getElementById('statusFolgas');
    const btnFolga = document.getElementById('btnFolga');
    
    if (config.folgasHabilitadas) {
        btnToggle.textContent = 'Desabilitar Folgas';
        btnToggle.className = 'btn btn-danger';
        statusFolgas.textContent = '✓ HABILITADAS';
        btnFolga.disabled = false;
        document.getElementById('alertFolgas').style.display = 'none';
    } else {
        btnToggle.textContent = 'Habilitar Folgas';
        btnToggle.className = 'btn btn-warning';
        statusFolgas.textContent = '✗ DESABILITADAS';
        btnFolga.disabled = true;
        document.getElementById('alertFolgas').style.display = 'block';
    }
}

// FORMS
function cadastrarPlantao() {
    const matricula = document.getElementById('plantaoMatricula').value;
    const nome = document.getElementById('plantaoNome').value;
    const data = document.getElementById('plantaoData').value;
    const posto = document.getElementById('plantaoPosto').value;
    const btn = document.getElementById('btnPlantao');

    if (!matricula) { alert('Preencha a matrícula!'); return; }
    if (!nome) { alert('Preencha o nome!'); return; }
    if (!data) { alert('Selecione a data!'); return; }
    if (!posto) { alert('Selecione um posto!'); return; }
    if (matricula.length !== 4) { alert('Matrícula deve ter 4 dígitos!'); return; }
    if (getVagasDisponiveis(data, posto) <= 0) { alert('Sem vagas disponíveis!'); return; }

    // Check for duplicates
    if (plantoes.some(p => p.matricula === matricula && p.data === data && p.posto === posto)) {
        alert('Plantão já cadastrado para esta matrícula, data e posto!');
        return;
    }

    btn.disabled = true;
    btn.textContent = 'Cadastrando...';

    db.collection('plantoes').add({ matricula, nome, data, posto, timestamp: Date.now() })
        .then(() => {
            document.getElementById('plantaoMatricula').value = '';
            document.getElementById('plantaoNome').value = '';
            document.getElementById('plantaoData').value = '';
            document.getElementById('plantaoPosto').value = '';
            alert('✓ Plantão cadastrado com sucesso!');
            // Switch to visualizar tab to show the updated list immediately
        })
        .catch(e => {
            alert('Erro: ' + e.message);
        })
        .finally(() => {
            btn.disabled = false;
            btn.textContent = 'Cadastrar Plantão';
        });
}

function cadastrarFolga() {
    if (!config.folgasHabilitadas) { alert('Folgas não habilitadas!'); return; }

    const matricula = document.getElementById('folgaMatricula').value;
    const nome = document.getElementById('folgaNome').value;
    const equipe = document.getElementById('folgaEquipe').value;
    const data = document.getElementById('folgaData').value;
    const btn = document.getElementById('btnFolga');

    if (!matricula || !nome || !equipe || !data) { alert('Preencha todos os campos!'); return; }
    if (matricula.length !== 4) { alert('Matrícula deve ter 4 dígitos!'); return; }
    if (!isFimDeSemanaOuFeriado(data)) { alert('Apenas fins de semana ou feriados!'); return; }

    // Check for duplicates
    if (folgas.some(f => f.matricula === matricula && f.equipe === equipe && f.data === data)) {
        alert('Folga já cadastrada para esta matrícula, equipe e data!');
        return;
    }

    const folgasNaData = folgas.filter(f => f.equipe === equipe && f.data === data);
    if (folgasNaData.length >= 8) { alert('Limite de 8 vagas atingido!'); return; }

    btn.disabled = true;
    btn.textContent = 'Cadastrando...';

    db.collection('folgas').add({ matricula, nome, equipe, data, timestamp: Date.now() })
        .then(() => {
            document.getElementById('folgaMatricula').value = '';
            document.getElementById('folgaNome').value = '';
            document.getElementById('folgaEquipe').value = '';
            document.getElementById('folgaData').value = '';
            alert('✓ Folga cadastrada com sucesso!');
        })
        .catch(e => {
            alert('Erro: ' + e.message);
        })
        .finally(() => {
            btn.disabled = false;
            btn.textContent = 'Cadastrar Folga';
        });
}

// LOGIN
function fazerLogin() {
    const senha = document.getElementById('adminPassword').value;
    if (senha === ADMIN_PASSWORD) {
        isAdmin = true;
        localStorage.setItem('adminLogado', 'true');
        document.getElementById('loginForm').style.display = 'none';
        document.getElementById('adminLoggedIn').style.display = 'block';
        document.getElementById('loginTabText').textContent = 'Admin';
        document.getElementById('adminRestricted').style.display = 'none';
        document.getElementById('adminPanel').style.display = 'flex';
        document.getElementById('adminFooter').style.display = 'block';
        atualizarTabelas();
        alert('✓ Login bem-sucedido!');
    } else {
        alert('❌ Senha incorreta!');
        document.getElementById('adminPassword').value = '';
    }
}

function fazerLogout() {
    isAdmin = false;
    localStorage.removeItem('adminLogado');
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('adminLoggedIn').style.display = 'none';
    document.getElementById('loginTabText').textContent = 'Login';
    document.getElementById('adminPassword').value = '';
    document.getElementById('adminRestricted').style.display = 'block';
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('adminFooter').style.display = 'none';
    atualizarTabelas();
    alert('✓ Logout realizado!');
}

// ADMIN
function configurarEscala() {
    const tipo = document.getElementById('tipoEscala').value;
    const mes = document.getElementById('mesEscala').value;
    const ano = document.getElementById('anoEscala').value;
    db.collection('configuracoes').doc('escala').set({ escalaConfig: { tipo, mes, ano } }, { merge: true })
        .then(() => { alert('✓ Escala configurada!'); })
        .catch(e => alert('Erro: ' + e.message));
}

function toggleFolgas() {
    db.collection('configuracoes').doc('escala').set({ folgasHabilitadas: !config.folgasHabilitadas }, { merge: true })
        .then(() => { alert(config.folgasHabilitadas ? '✓ Folgas desabilitadas!' : '✓ Folgas habilitadas!'); })
        .catch(e => alert('Erro: ' + e.message));
}

function adicionarDataManual() {
    const data = document.getElementById('dataManual').value;
    if (!data) { alert('Selecione uma data!'); return; }
    if (isFimDeSemana(data)) { alert('Sem finais de semana!'); return; }
    if (config.datasManual && config.datasManual.includes(data)) { alert('Já adicionada!'); return; }
    
    const datasAtuais = config.datasManual || [];
    db.collection('configuracoes').doc('escala').set({ 
        datasManual: [...datasAtuais, data].sort(),
        escalaConfig: { tipo: 'manual', mes: '', ano: '' }
    }, { merge: true })
        .then(() => { document.getElementById('dataManual').value = ''; alert('✓ Data adicionada!'); })
        .catch(e => alert('Erro: ' + e.message));
}

function removerDataManual(data) {
    if (confirm('Remover ' + formatarData(data) + '?')) {
        const datasAtuais = config.datasManual || [];
        db.collection('configuracoes').doc('escala').set({ 
            datasManual: datasAtuais.filter(d => d !== data) 
        }, { merge: true })
            .then(() => alert('✓ Removida!'))
            .catch(e => alert('Erro: ' + e.message));
    }
}

function limparEscalaManual() {
    const datasAtuais = config.datasManual || [];
    if (datasAtuais.length === 0) { alert('Sem datas!'); return; }
    if (confirm('Limpar todas as datas manuais?')) {
        db.collection('configuracoes').doc('escala').set({
            datasManual: [],
            escalaConfig: { tipo: '', mes: '', ano: '' }
        }, { merge: true })
            .then(() => alert('✓ Limpo!'))
            .catch(e => alert('Erro: ' + e.message));
    }
}

function atualizarListaDatasManual() {
    const container = document.getElementById('datasManualContainer');
    const totalElement = document.getElementById('totalDatasManual');
    
    if (!container) return;
    
    const datasAtuais = config.datasManual || [];
    if (totalElement) totalElement.textContent = datasAtuais.length;
    
    if (datasAtuais.length === 0) {
        container.innerHTML = '<p class="text-small">Nenhuma data adicionada.</p>';
        return;
    }
    
    let html = '';
    datasAtuais.forEach(data => {
        const dataObj = new Date(data + 'T00:00:00');
        const diaSemana = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'][dataObj.getDay()];
        html += `<div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem; background: #f3f4f6; border-radius: 6px; margin-bottom: 0.5rem; border-left: 3px solid #0095da;">
            <span class="text-small"><strong>${formatarData(data)}</strong> - ${diaSemana}</span>
            <button class="btn btn-danger btn-small" onclick="removerDataManual('${data}')">✗</button>
        </div>`;
    });
    container.innerHTML = html;
}

function adicionarFeriado() {
    const data = document.getElementById('dataFeriado').value;
    if (!data) { alert('Selecione uma data!'); return; }
    if (config.feriados.includes(data)) { alert('Já cadastrado!'); return; }
    
    db.collection('configuracoes').doc('escala').set({ feriados: [...config.feriados, data].sort() }, { merge: true })
        .then(() => { document.getElementById('dataFeriado').value = ''; alert('✓ Feriado adicionado!'); })
        .catch(e => alert('Erro: ' + e.message));
}

function removerFeriado(data) {
    if (confirm('Remover feriado?')) {
        db.collection('configuracoes').doc('escala').set({ feriados: config.feriados.filter(d => d !== data) }, { merge: true })
            .catch(e => alert('Erro: ' + e.message));
    }
}

function limparFeriados() {
    if (confirm('Limpar todos os feriados?')) {
        db.collection('configuracoes').doc('escala').set({ feriados: [] }, { merge: true })
            .catch(e => alert('Erro: ' + e.message));
    }
}

function atualizarListaFeriados() {
    const container = document.getElementById('feriadosContainer');
    if (config.feriados.length === 0) {
        container.innerHTML = '<p class="text-small">Nenhum feriado cadastrado.</p>';
        return;
    }
    let html = '<div>';
    config.feriados.forEach(data => {
        html += `<div style="display: flex; justify-content: space-between; padding: 0.5rem; background: #fef3c7; border-radius: 6px; margin-bottom: 0.5rem; border-left: 3px solid #f59e0b;">
            <span class="text-small"><strong>${formatarData(data)}</strong></span>
            <button class="btn btn-danger btn-small" onclick="removerFeriado('${data}')">✗</button>
        </div>`;
    });
    html += '</div>';
    container.innerHTML = html;
}

function exportarDados() {
    if (plantoes.length === 0 && folgas.length === 0) { alert('Sem dados!'); return; }
    
    let csv = 'SISTEMA DE GESTÃO DE REFORÇO\n\n';
    csv += '=== PLANTÕES ===\nMatrícula;Nome;Data;Posto\n';
    plantoes.forEach(p => { csv += `${p.matricula};${p.nome};${formatarData(p.data)};${p.posto}\n`; });
    csv += `\nTotal: ${plantoes.length}\n\n`;
    csv += '=== FOLGAS ===\nMatrícula;Nome;Equipe;Data\n';
    folgas.forEach(f => { csv += `${f.matricula};${f.nome};${f.equipe};${formatarData(f.data)}\n`; });
    csv += `\nTotal: ${folgas.length}\n`;
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `reforco-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

function removerPlantao(id) {
    if (confirm('Remover plantão?')) {
        db.collection('plantoes').doc(id).delete()
            .then(() => {
                alert('✓ Plantão removido!');
                atualizarTabelas();
                updatePostos();
            })
            .catch(e => alert('Erro: ' + e.message));
    }
}

function removerFolga(id) {
    if (confirm('Remover folga?')) {
        db.collection('folgas').doc(id).delete()
            .then(() => {
                alert('✓ Folga removida!');
                atualizarTabelas();
                atualizarFolgas();
            })
            .catch(e => alert('Erro: ' + e.message));
    }
}

function limparDados() {
    if (confirm('ATENÇÃO: Isso vai apagar TODOS os dados!')) {
        if (confirm('Tem CERTEZA? Esta ação é IRREVERSÍVEL!')) {
            db.collection('plantoes').get().then(snap => snap.docs.forEach(d => d.ref.delete()));
            db.collection('folgas').get().then(snap => snap.docs.forEach(d => d.ref.delete()));
            db.collection('configuracoes').doc('escala').set({
                escalaConfig: { tipo: '', mes: '', ano: '' },
                folgasHabilitadas: false,
                feriados: []
            }).then(() => alert('✓ Dados apagados!'));
        }
    }
}

// LISTENERS
db.collection('plantoes').onSnapshot(snapshot => {
    plantoes = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.timestamp - b.timestamp);
    atualizarResumoPlantoes();
    atualizarTabelas();
});

db.collection('folgas').onSnapshot(snapshot => {
    folgas = snapshot.docs.map(d => ({ id: d.id, ...d.data() })).sort((a, b) => a.timestamp - b.timestamp);
    atualizarFolgas();
    atualizarTabelas();
});

db.collection('configuracoes').doc('escala').onSnapshot(doc => {
    if (doc.exists) {
        config = doc.data();
        atualizarEscala();
        atualizarFolgasStatus();
        atualizarListaFeriados();
    }
});

// Tornar funções globais
window.updatePostos = updatePostos;
window.checkFimSemanaFolga = checkFimSemanaFolga;
window.changeTab = changeTab;
window.cadastrarPlantao = cadastrarPlantao;
window.cadastrarFolga = cadastrarFolga;
window.fazerLogin = fazerLogin;
window.fazerLogout = fazerLogout;
window.configurarEscala = configurarEscala;
window.toggleFolgas = toggleFolgas;
window.adicionarFeriado = adicionarFeriado;
window.removerFeriado = removerFeriado;
window.limparFeriados = limparFeriados;
window.adicionarDataManual = adicionarDataManual;
window.removerDataManual = removerDataManual;
window.limparEscalaManual = limparEscalaManual;
window.removerPlantao = removerPlantao;
window.removerFolga = removerFolga;
window.exportarDados = exportarDados;
window.limparDados = limparDados;
    document.querySelectorAll('.tab-button').forEach(btn => {
        btn.addEventListener('click', function() {
            changeTab(this.getAttribute('data-tab'), this);
        });
    });
    
    document.getElementById('adminPassword').addEventListener('keypress', e => {
        if (e.key === 'Enter') fazerLogin();
    });
    
    setTimeout(() => {
        document.getElementById('loadingVisualizar').style.display = 'none';
        document.getElementById('tabelasContainer').style.display = 'block';
    }, 500);
; 