// ==========================================
// 1. IMPORTAÇÕES OBRIGATÓRIAS (TOPO ABSOLUTO)
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// ==========================================
// 2. CONFIGURAÇÕES INFRAESTRUTURA
// ==========================================
const DISCOGS_TOKEN = "BECGofjKQBJqAgRHPhnZlQOQUbVEGnDtiALEpmPB";

const firebaseConfig = {
    apiKey: "AIzaSyAVqrOH83O8C297l4C9C-hmxKXmzxdvD28",
    authDomain: "vinildiscogs.firebaseapp.com",
    projectId: "vinildiscogs",
    storageBucket: "vinildiscogs.firebasestorage.app",
    messagingSenderId: "937806904189",
    appId: "1:937806904189:web:8b9df493b56ad306d8aa14",
    measurementId: "G-MKBYBS7CBS"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app); 

const colecaoEstoque = collection(db, "estoque");
const colecaoVendas = collection(db, "vendas");
const colecaoExclusoes = collection(db, "exclusoes");
const colecaoEstornos = collection(db, "estornos");

// Variáveis de Estado Local
let estoqueVinis = [];
let termoFiltroEstoque = ""; 
let metodoOrdenacao = "recentes";

const loginContainer = document.getElementById('login-container');
const appContainer = document.getElementById('app-container');

// ==========================================
// 3. MONITORAMENTO DO LOGIN
// ==========================================
onAuthStateChanged(auth, (user) => {
    if (user) {
        if (loginContainer) loginContainer.style.display = 'none';
        if (appContainer) appContainer.style.display = 'block';
        carregarDados();
    } else {
        if (loginContainer) loginContainer.style.display = 'flex';
        if (appContainer) appContainer.style.display = 'none';
        estoqueVinis = [];
    }
});

const formLogin = document.getElementById('form-login');
if (formLogin) {
    formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value.trim();
        const senha = document.getElementById('login-senha').value;
        const btn = formLogin.querySelector('button');
        
        btn.textContent = "Validando...";
        btn.disabled = true;
        
        try {
            await signInWithEmailAndPassword(auth, email, senha);
            formLogin.reset();
            mostrarMensagem("Acesso autorizado!");
        } catch (erro) {
            console.error("Erro de login:", erro);
            alert("Acesso negado: E-mail ou senha incorretos.");
        } finally {
            btn.textContent = "Entrar no Sistema";
            btn.disabled = false;
        }
    });
}

const btnSair = document.getElementById('btn-sair');
if (btnSair) {
    btnSair.addEventListener('click', async () => {
        if (confirm("Deseja realmente fechar a sessão e sair do sistema?")) {
            try {
                await signOut(auth);
                const sessaoHistorico = document.getElementById('sessao-historico');
                const btnToggleHistorico = document.getElementById('btn-toggle-historico');
                if (sessaoHistorico) sessaoHistorico.style.display = 'none';
                if (btnToggleHistorico) btnToggleHistorico.textContent = "Ver Histórico de Vendas";
            } catch (erro) {
                console.error("Erro de logout:", erro);
            }
        }
    });
}

// ==========================================
// 4. HISTÓRICO DE VENDAS & ESTORNO
// ==========================================
const btnToggleHistorico = document.getElementById('btn-toggle-historico');
const sessaoHistorico = document.getElementById('sessao-historico');
const listaHistorico = document.getElementById('lista-historico');

// NOVA LÓGICA: Variáveis para a busca do histórico
let historicoVendas = []; 
let termoFiltroHistorico = "";

// Escutador do campo de busca que acabamos de criar no HTML
const inputBuscaHistorico = document.getElementById('busca-historico');
if (inputBuscaHistorico) {
    inputBuscaHistorico.addEventListener('input', (e) => {
        termoFiltroHistorico = e.target.value.toLowerCase();
        renderizarHistorico(); // Filtra na tela em tempo real
    });
}

if (btnToggleHistorico && sessaoHistorico) {
    btnToggleHistorico.addEventListener('click', async () => {
        if (sessaoHistorico.style.display === 'none') {
            sessaoHistorico.style.display = 'block';
            btnToggleHistorico.textContent = "Esconder Histórico";
            await carregarEMostrarHistorico();
        } else {
            sessaoHistorico.style.display = 'none';
            btnToggleHistorico.textContent = "Ver Histórico de Vendas";
        }
    });
}

async function carregarEMostrarHistorico() {
    const lista = document.getElementById('lista-historico');
    if (lista) lista.innerHTML = '<p style="color: #666;">Carregando...</p>';
    
    try {
        const snap = await getDocs(colecaoVendas);
        
        // CORRIGIDO: Agora salvamos os dados no estado global para o filtro funcionar!
        historicoVendas = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        historicoVendas.sort((a, b) => new Date(b.data) - new Date(a.data));

        // Passa o bastão para a função que realmente renderiza
        renderizarHistorico();
    } catch (erro) {
        console.error("Erro ao carregar histórico do Firebase:", erro);
        if (lista) lista.innerHTML = '<p style="color: #f44336;">Erro ao carregar o histórico.</p>';
    }
}

// Aplica o filtro de busca e desenha os cards na tela
function renderizarHistorico() {
    if (!listaHistorico) return;

    if (historicoVendas.length === 0) {
        listaHistorico.innerHTML = '<p style="color: #666; font-size: 0.9rem;">Nenhuma venda registrada ainda.</p>';
        return;
    }

    // Filtra pelo título digitado
    const vendasParaExibir = historicoVendas.filter(venda => {
        const titulo = (venda.titulo || "").toLowerCase();
        return titulo.includes(termoFiltroHistorico);
    });

    listaHistorico.innerHTML = ''; 

    if (vendasParaExibir.length === 0) {
        listaHistorico.innerHTML = '<p style="color: #aaa; font-size: 0.9rem; margin-top: 10px;">Nenhuma venda encontrada com esse termo.</p>';
        return;
    }

    vendasParaExibir.forEach(venda => {
        const dataObj = new Date(venda.data);
        const dataFormatada = dataObj.toLocaleDateString('pt-BR') + ' às ' + dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        
        const valorVenda = Number(venda.venda || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const lucroVenda = Number((venda.venda || 0) - (venda.custo || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

        const item = document.createElement('div');
        item.className = 'item-historico';
        item.style.display = 'flex';
        item.style.alignItems = 'center';
        item.style.gap = '15px';
        item.style.padding = '10px';
        item.style.borderBottom = '1px solid #333';
        
        item.innerHTML = `
            ${venda.capa ? `<img src="${venda.capa}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">` : 
                           `<div style="width: 50px; height: 50px; background: #333; border-radius: 4px;"></div>`}
            
            <div style="flex-grow: 1;">
                <div style="display: flex; align-items: baseline; gap: 10px; margin-bottom: 5px;">
                    <strong style="color: #fff; font-size: 0.95rem;">${venda.titulo || 'Disco sem título'}</strong>
                    <span style="color: #888; font-size: 0.75rem;">${dataFormatada}</span>
                </div>
                
                ${(venda.condicaoMidia || venda.condicaoCapa) ? `
                <div style="font-size: 0.8rem; color: #aaa; margin-bottom: 8px; margin-top: -2px;">
                    Mídia: <strong style="color: #4caf50;">${venda.condicaoMidia || '?'}</strong> | Capa: <strong style="color: #4caf50;">${venda.condicaoCapa || '?'}</strong>
                </div>
                ` : ''}

                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;">
                    <div>
                        <span style="color: #aaa;">Venda: <strong style="color: #fff;">${valorVenda}</strong></span> |
                        <span style="color: #aaa;">Lucro: <strong style="color: #4caf50;">${lucroVenda}</strong></span>
                    </div>
                </div>
            </div>
            
            <button class="btn-estornar" data-id="${venda.id}" style="background: #d32f2f; color: white; border: none; padding: 5px 10px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; font-weight: bold; transition: 0.2s;">
                Estornar
            </button>
        `;
        listaHistorico.appendChild(item);
    });

    // Escutador de eventos seguro para ambiente de Módulos (ES Modules)
    document.querySelectorAll('.btn-estornar').forEach(btn => {
        btn.addEventListener('click', () => estornarVenda(btn.dataset.id));
    });
}

async function estornarVenda(idVenda) {
    const motivoEstorno = prompt("Qual o motivo do estorno desta venda?");
    
    // Se o usuário cancelar o prompt ou deixar vazio, cancela a ação
    if (motivoEstorno === null || motivoEstorno.trim() === "") {
        mostrarMensagem("Estorno cancelado: motivo é obrigatório.");
        return;
    }

    if (!confirm("O valor cobrado será subtraído das finanças e 1 unidade voltará ao estoque. Confirmar estorno?")) return;

    try {
        const vendaRef = doc(db, "vendas", idVenda);
        const snapVenda = await getDoc(vendaRef);
        
        if (!snapVenda.exists()) {
            alert("Venda não encontrada ou já estornada.");
            return;
        }
        const dadosVenda = snapVenda.data();

        // SALVA O HISTÓRICO DO ESTORNO
        const registroEstorno = {
            titulo: dadosVenda.titulo || 'Disco sem título',
            condicaoMidia: dadosVenda.condicaoMidia || '',
            condicaoCapa: dadosVenda.condicaoCapa || '',
            motivo: motivoEstorno,
            dataEstorno: new Date().toISOString(),
            vendaOriginalData: dadosVenda.data || '',
            capa: dadosVenda.capa || ''
        };
        await addDoc(colecaoEstornos, registroEstorno);

        // Remove do banco de dados de vendas
        await deleteDoc(vendaRef);
        await atualizarDashboardPeriodos();

        const discoNoEstoque = estoqueVinis.find(d => (d.titulo || "").toLowerCase() === (dadosVenda.titulo || "").toLowerCase());
        
        if (discoNoEstoque) {
            const discoRef = doc(db, "estoque", discoNoEstoque.id);
            const novaQtd = (discoNoEstoque.quantidade || 0) + 1;
            
            await updateDoc(discoRef, { quantidade: novaQtd });
            
            discoNoEstoque.quantidade = novaQtd;
            renderizarEstoque();
            mostrarMensagem("Venda desfeita, motivo registrado e disco devolvido ao estoque!");
        } else {
            mostrarMensagem("Estorno registrado! (O disco não voltou ao estoque porque foi excluído da loja).");
        }

        await carregarEMostrarHistorico();

    } catch (erro) {
        console.error("Erro ao estornar compra:", erro);
        alert("Erro ao processar o estorno no Firebase.");
    }
}

// ==========================================
// 5. MODAL DE PESQUISA (DISCOGS) COM PAGINAÇÃO
// ==========================================
const btnAbrirDiscogs = document.getElementById('btn-abrir-discogs');
const modalDiscogs = document.getElementById('modal-discogs');
const btnFecharModal = document.getElementById('btn-fechar-modal');
const inputModalDiscogs = document.getElementById('input-modal-discogs');
const resultadosModal = document.getElementById('resultados-modal');

const paginacaoContainer = document.getElementById('paginacao-discogs');
const btnPaginaAnterior = document.getElementById('btn-pagina-anterior');
const btnPaginaProxima = document.getElementById('btn-pagina-proxima');
const infoPagina = document.getElementById('info-pagina');

let timerBuscaDiscogs;
let termoBuscaAtual = "";
let paginaAtualDiscogs = 1;

if (btnAbrirDiscogs && modalDiscogs) {
    btnAbrirDiscogs.addEventListener('click', () => {
        modalDiscogs.style.display = 'flex';
        inputModalDiscogs.focus();
        document.body.style.overflow = 'hidden'; 
    });
}

if (btnFecharModal && modalDiscogs) {
    btnFecharModal.addEventListener('click', () => {
        modalDiscogs.style.display = 'none';
        document.body.style.overflow = 'auto'; 
    });
}

if (inputModalDiscogs) {
    inputModalDiscogs.addEventListener('input', (e) => {
        termoBuscaAtual = e.target.value.trim();
        paginaAtualDiscogs = 1; 
        
        clearTimeout(timerBuscaDiscogs);

        if (termoBuscaAtual.length >= 3) {
            resultadosModal.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #aaa; margin-top: 40px;">Buscando no banco de dados mundial...</p>';
            if(paginacaoContainer) paginacaoContainer.style.display = 'none';
            
            timerBuscaDiscogs = setTimeout(() => {
                executarBuscaDiscogsModal(termoBuscaAtual, paginaAtualDiscogs);
            }, 800);
        } else {
            resultadosModal.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #888; margin-top: 40px; font-size: 1.1rem;">Digite algo acima para pesquisar em milhões de discos.</p>';
            if(paginacaoContainer) paginacaoContainer.style.display = 'none';
        }
    });
}

if (btnPaginaAnterior) {
    btnPaginaAnterior.addEventListener('click', () => {
        if (paginaAtualDiscogs > 1) {
            paginaAtualDiscogs--;
            executarBuscaDiscogsModal(termoBuscaAtual, paginaAtualDiscogs);
            document.querySelector('.modal-body').scrollTo({ top: 0, behavior: 'smooth' }); 
        }
    });
}

if (btnPaginaProxima) {
    btnPaginaProxima.addEventListener('click', () => {
        paginaAtualDiscogs++;
        executarBuscaDiscogsModal(termoBuscaAtual, paginaAtualDiscogs);
        document.querySelector('.modal-body').scrollTo({ top: 0, behavior: 'smooth' });
    });
}

async function executarBuscaDiscogsModal(termo, pagina) {
    try {
        resultadosModal.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #aaa; margin-top: 40px;">Carregando página ' + pagina + '...</p>';
        
        const url = `https://api.discogs.com/database/search?q=${encodeURIComponent(termo)}&type=release&per_page=12&page=${pagina}&token=${DISCOGS_TOKEN}`;
        const resposta = await fetch(url);
        const dados = await resposta.json();

        resultadosModal.innerHTML = ''; 

        if (dados.results && dados.results.length > 0) {
            
            if (paginacaoContainer) {
                paginacaoContainer.style.display = 'flex';
                infoPagina.textContent = `Página ${dados.pagination.page} de ${dados.pagination.pages}`;
                
                btnPaginaAnterior.disabled = dados.pagination.page === 1;
                btnPaginaProxima.disabled = dados.pagination.page === dados.pagination.pages;
            }

            dados.results.forEach(resultado => {
                const partesTitulo = resultado.title.split(' - ');
                const artista = partesTitulo[0] || '';
                const titulo = partesTitulo[1] || resultado.title;
                
                const ano = resultado.year || '';
                const genero = (resultado.genre && resultado.genre.length > 0) ? resultado.genre.join(', ') : '';
                const urlDaCapa = resultado.cover_image || ''; 
                
                const formato = resultado.format ? resultado.format.slice(0, 2).join(' ') : 'Vinil/CD';
                const catno = resultado.catno && resultado.catno !== 'none' ? resultado.catno : '';
                const linkDiscogs = resultado.id ? `https://www.discogs.com/release/${resultado.id}` : '';

                const card = document.createElement('div');
                card.className = 'card-resultado';
                
                const imgHTML = urlDaCapa 
                    ? `<img src="${urlDaCapa}" alt="Capa">`
                    : `<div style="height: 220px; background: #2a2a2a; display: flex; align-items: center; justify-content: center; color: #888;">Sem Imagem</div>`;

                card.innerHTML = `
                    ${imgHTML}
                    <div class="card-info">
                        <strong>${resultado.title}</strong>
                        <span>${ano} ${genero ? '• ' + genero : ''}<br>${formato} ${catno ? ' | ' + catno : ''}</span>
                        <button class="btn-adicionar-modal">Adicionar</button>
                    </div>
                `;

                const btnAdd = card.querySelector('.btn-adicionar-modal');
                btnAdd.addEventListener('click', () => {
                    const campos = {
                        'titulo': titulo.trim(),
                        'artista': artista.trim(),
                        'url-capa': urlDaCapa,
                        'ano-disco': ano,
                        'genero-disco': genero,
                        'formato-disco': formato,
                        'catno-disco': catno,
                        'link-discogs': linkDiscogs
                    };

                    for (const [id, valor] of Object.entries(campos)) {
                        const el = document.getElementById(id);
                        if (el) el.value = valor;
                    }
                    
                    const preview = document.getElementById('preview-capa');
                    if (urlDaCapa && preview) {
                        preview.src = urlDaCapa;
                        preview.style.display = 'block';
                    }

                    modalDiscogs.style.display = 'none';
                    document.body.style.overflow = 'auto';
                    inputModalDiscogs.value = '';
                    resultadosModal.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #888; margin-top: 40px; font-size: 1.1rem;">Digite algo acima para pesquisar em milhões de discos.</p>';
                    if(paginacaoContainer) paginacaoContainer.style.display = 'none';
                    
                    document.getElementById('form-disco').scrollIntoView({ behavior: 'smooth', block: 'center' });
                    mostrarMensagem("Disco importado para o formulário!");
                });

                resultadosModal.appendChild(card);
            });
        } else {
            resultadosModal.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #ff9800; margin-top: 40px;">Nenhum álbum encontrado com este nome.</p>';
            if(paginacaoContainer) paginacaoContainer.style.display = 'none';
        }
    } catch (erro) {
        console.error("Erro no Discogs:", erro);
        resultadosModal.innerHTML = '<p style="grid-column: 1 / -1; text-align: center; color: #f44336; margin-top: 40px;">Erro de conexão com o banco de dados do Discogs.</p>';
        if(paginacaoContainer) paginacaoContainer.style.display = 'none';
    }
}

// ==========================================
// 6. FILTROS E ORDENAÇÃO DE ESTOQUE LOCAL
// ==========================================
const inputBuscaEstoque = document.getElementById('busca-estoque'); 
if (inputBuscaEstoque) {
    inputBuscaEstoque.addEventListener('input', (e) => {
        termoFiltroEstoque = e.target.value.toLowerCase();
        renderizarEstoque(); 
    });
}

const selectOrdenacao = document.getElementById('ordenar-estoque'); 
if (selectOrdenacao) {
    selectOrdenacao.addEventListener('change', (e) => {
        metodoOrdenacao = e.target.value;
        renderizarEstoque();
    });
}

// ==========================================
// 7. CARREGAMENTO E DASHBOARD (DINÂMICO / PERÍODOS)
// ==========================================
async function carregarDados() {
    try {
        const snapshotEstoque = await getDocs(colecaoEstoque);
        estoqueVinis = snapshotEstoque.docs.map(d => ({ id: d.id, ...d.data() }));

        await atualizarDashboardPeriodos();
        renderizarEstoque();
    } catch (erro) {
        console.error("Erro ao carregar dados:", erro);
        const tabela = document.getElementById('tabela-estoque');
        if(tabela) tabela.innerHTML = '<tr><td colspan="6" class="esgotado">Erro ao conectar com o banco de dados.</td></tr>';
    }
}

async function atualizarDashboardPeriodos() {
    try {
        const snapshotVendas = await getDocs(colecaoVendas);
        const vendasArray = snapshotVendas.docs.map(d => ({ id: d.id, ...d.data() }));

        const agora = new Date();
        const hojeStr = agora.toLocaleDateString('pt-BR');
        const mesAtual = agora.getMonth();
        const anoAtual = agora.getFullYear();

        const periodos = {
            dia: { faturamento: 0, custo: 0, vendas: 0 },
            mes: { faturamento: 0, custo: 0, vendas: 0 },
            ano: { faturamento: 0, custo: 0, vendas: 0 },
            total: { faturamento: 0, custo: 0, vendas: 0 }
        };

        vendasArray.forEach(venda => {
            const dataVenda = new Date(venda.data);
            const valorVenda = Number(venda.venda || 0);
            const valorCusto = Number(venda.custo || 0);

            // Totalizador Geral
            periodos.total.faturamento += valorVenda;
            periodos.total.custo += valorCusto;
            periodos.total.vendas += 1;

            // Totalizador do Ano Atual
            if (dataVenda.getFullYear() === anoAtual) {
                periodos.ano.faturamento += valorVenda;
                periodos.ano.custo += valorCusto;
                periodos.ano.vendas += 1;

                // Totalizador do Mês Atual
                if (dataVenda.getMonth() === mesAtual) {
                    periodos.mes.faturamento += valorVenda;
                    periodos.mes.custo += valorCusto;
                    periodos.mes.vendas += 1;
                }
            }

            // Totalizador de Hoje
            if (dataVenda.toLocaleDateString('pt-BR') === hojeStr) {
                periodos.dia.faturamento += valorVenda;
                periodos.dia.custo += valorCusto;
                periodos.dia.vendas += 1;
            }
        });

        renderizarMetricasPeriodo('dia', periodos.dia);
        renderizarMetricasPeriodo('mes', periodos.mes);
        renderizarMetricasPeriodo('ano', periodos.ano);
        renderizarMetricasPeriodo('total', periodos.total);

    } catch (erro) {
        console.error("Erro ao calcular métricas:", erro);
    }
}

function renderizarMetricasPeriodo(prefixo, dados) {
    const lucro = dados.faturamento - dados.custo;

    const elFaturamento = document.getElementById(`${prefixo}-faturamento`);
    const elCusto = document.getElementById(`${prefixo}-custo`);
    const elLucro = document.getElementById(`${prefixo}-lucro`);
    const elQtd = document.getElementById(`${prefixo}-vendas`);

    if (elFaturamento) elFaturamento.textContent = dados.faturamento.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (elCusto) elCusto.textContent = dados.custo.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (elLucro) elLucro.textContent = lucro.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    if (elQtd) elQtd.textContent = dados.vendas;
}

// ==========================================
// 8. RENDERIZAÇÃO DA TABELA DE ESTOQUE
// ==========================================
function renderizarEstoque() {
    const tabela = document.getElementById('tabela-estoque');
    if (!tabela) return;
    
    tabela.innerHTML = '';

    let discosParaExibir = estoqueVinis.filter(disco => {
        const titulo = (disco.titulo || "").toLowerCase();
        const artista = (disco.artista || "").toLowerCase();
        return titulo.includes(termoFiltroEstoque) || artista.includes(termoFiltroEstoque);
    });

    if (metodoOrdenacao === 'recentes') {
        discosParaExibir.sort((a, b) => (b.dataCriacao || 0) - (a.dataCriacao || 0));
    } else if (metodoOrdenacao === 'artista') {
        discosParaExibir.sort((a, b) => (a.artista || "").localeCompare(b.artista || ""));
    } else if (metodoOrdenacao === 'preco-maior') {
        discosParaExibir.sort((a, b) => (b.precoVenda || 0) - (a.precoVenda || 0));
    } else if (metodoOrdenacao === 'preco-menor') {
        discosParaExibir.sort((a, b) => (a.precoVenda || 0) - (b.precoVenda || 0));
    } 

    if (discosParaExibir.length === 0) {
        tabela.innerHTML = '<tr><td colspan="6" class="empty-message">Nenhum disco encontrado.</td></tr>';
        return;
    }

    discosParaExibir.forEach((disco) => {
        const linha = document.createElement('tr');
        
        // Formata os dois valores em moeda (BRL)
        const precoFormatado = Number(disco.precoVenda || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const custoFormatado = Number(disco.precoCusto || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        let statusEstoque = '';
        if (disco.quantidade === 0) {
            statusEstoque = '<span class="esgotado">Esgotado</span>';
        } else {
            statusEstoque = disco.quantidade;
        }

        const imgCapa = disco.capa 
            ? `<img src="${disco.capa}" style="width: 55px; height: 55px; object-fit: cover; border-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.5);">` 
            : `<div style="width: 55px; height: 55px; background: #333; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 10px;">Sem Capa</div>`;

        const generosHtml = disco.genero 
            ? disco.genero.split(',').map(g => `<span class="badge genero">${g.trim()}</span>`).join(' ') 
            : '';

        const tagsHtml = `
            <div class="badges-container">
                ${generosHtml}
                ${disco.ano ? `<span class="badge ano">${disco.ano}</span>` : ''}
                ${disco.formato ? `<span class="badge formato">${disco.formato}</span>` : ''}
                ${disco.catno ? `<span class="badge catno">${disco.catno}</span>` : ''}
            </div>
        `;
        
        const condicao = (disco.condicaoMidia || disco.condicaoCapa) 
            ? `<div class="condicao-box">Mídia: <strong>${disco.condicaoMidia || '?'}</strong> | Capa: <strong>${disco.condicaoCapa || '?'}</strong></div>`
            : '';
            
        const btnDiscogsHtml = disco.linkDiscogs 
            ? `<a href="${disco.linkDiscogs}" target="_blank" class="btn-acao btn-link">Discogs</a>`
            : '';

        linha.innerHTML = `
            <td data-label="Capa">${imgCapa}</td>
            <td data-label="Título / Info">
                <strong>${disco.titulo || 'Sem Título'}</strong>
                ${tagsHtml}
            </td>
            <td data-label="Artista / Condição">
                ${disco.artista || 'Sem Artista'}
                ${condicao}
            </td>
            <td data-label="Estoque">${statusEstoque}</td>
            
            <td data-label="Preço">
                <div style="font-weight: bold; color: #fff;">${precoFormatado}</div>
                <div style="font-size: 0.75rem; color: #ff9800; margin-top: 4px; white-space: nowrap;">Custo: ${custoFormatado}</div>
            </td>
            
            <td data-label="Ações">
                <div class="acoes-tabela">
                    <button class="btn-acao btn-vender ${disco.quantidade === 0 ? 'btn-disabled' : ''}"
                            data-id="${disco.id}"
                            ${disco.quantidade === 0 ? 'disabled' : ''}>Vender</button>
                    ${btnDiscogsHtml}
                    <button class="btn-acao btn-editar" data-id="${disco.id}">Editar</button>
                    <button class="btn-acao btn-remover" data-id="${disco.id}">Excluir</button>
                </div>
            </td>
        `;
        tabela.appendChild(linha);
    });

    document.querySelectorAll('.btn-vender').forEach(btn => {
        btn.addEventListener('click', (e) => venderDisco(e.target.dataset.id));
    });
    document.querySelectorAll('.btn-editar').forEach(btn => {
        btn.addEventListener('click', (e) => alterarPrecoDisco(e.target.dataset.id));
    });
    document.querySelectorAll('.btn-remover').forEach(btn => {
        btn.addEventListener('click', (e) => removerDisco(e.target.dataset.id));
    });
}

// ==========================================
// 9. SALVAR NO ESTOQUE 
// ==========================================
const formDisco = document.getElementById('form-disco'); 
if (formDisco) {
    formDisco.addEventListener('submit', async (e) => {
        e.preventDefault();
        const btnSalvar = document.getElementById('btn-salvar');
        if (btnSalvar) {
            btnSalvar.textContent = "Salvando...";
            btnSalvar.disabled = true;
        }

        const titulo = document.getElementById('titulo').value.trim();
        const artista = document.getElementById('artista').value.trim();

        const duplicata = estoqueVinis.find(
            d => (d.titulo || "").toLowerCase() === titulo.toLowerCase() &&
                 (d.artista || "").toLowerCase() === artista.toLowerCase()
        );

        if (duplicata) {
            if (!confirm(`"${titulo}" de ${artista} já está no estoque. Deseja adicionar mesmo assim?`)) {
                if (btnSalvar) {
                    btnSalvar.textContent = "Salvar no Estoque";
                    btnSalvar.disabled = false;
                }
                return;
            }
        }

        const pegaValor = (id) => {
            const el = document.getElementById(id);
            return el ? el.value : '';
        };

        const novoDisco = {
            titulo,
            artista,
            capa: pegaValor('url-capa'),
            ano: pegaValor('ano-disco'),
            genero: pegaValor('genero-disco'),
            formato: pegaValor('formato-disco'),
            catno: pegaValor('catno-disco'),
            linkDiscogs: pegaValor('link-discogs'),
            condicaoMidia: pegaValor('condicao-midia'),
            condicaoCapa: pegaValor('condicao-capa'),
            quantidade: parseInt(pegaValor('quantidade') || 0),
            precoCusto: parseFloat(pegaValor('preco-custo') || 0),
            precoVenda: parseFloat(pegaValor('preco-venda') || 0),
            dataCriacao: Date.now()
        };  

        try {
            const docRef = await addDoc(colecaoEstoque, novoDisco);
            estoqueVinis.push({ id: docRef.id, ...novoDisco });
            
            renderizarEstoque();
            formDisco.reset();
            
            ['url-capa', 'ano-disco', 'genero-disco', 'formato-disco', 'catno-disco', 'link-discogs'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });
            
            const preview = document.getElementById('preview-capa');
            if (preview) preview.style.display = 'none';

            mostrarMensagem("Disco adicionado ao estoque!");
        } catch (erro) {
            console.error("Erro ao salvar:", erro);
            alert("Erro ao salvar o disco no banco de dados.");
        } finally {
            if (btnSalvar) {
                btnSalvar.textContent = "Salvar no Estoque";
                btnSalvar.disabled = false;
            }
        }
    });
}

// ==========================================
// 10. REGISTRAR VENDA
// ==========================================
async function venderDisco(idDisco) {
    const discoIndex = estoqueVinis.findIndex(d => d.id === idDisco);
    const disco = estoqueVinis[discoIndex];

    if (!disco || disco.quantidade <= 0) return;

    try {
        const discoRef = doc(db, "estoque", idDisco);
        await updateDoc(discoRef, { quantidade: disco.quantidade - 1 });

        const novaVenda = {
            titulo: disco.titulo || 'Disco sem título',
            custo: Number(disco.precoCusto || 0),
            venda: Number(disco.precoVenda || 0),
            // Salvando a condição no registro de venda também
            condicaoMidia: disco.condicaoMidia || '',
            condicaoCapa: disco.condicaoCapa || '',
            data: new Date().toISOString(),
            capa: disco.capa || ''
        };
        await addDoc(colecaoVendas, novaVenda);

        // Recalcula o dashboard dinamicamente por períodos
        await atualizarDashboardPeriodos();

        estoqueVinis[discoIndex].quantidade -= 1;
        
        const sessaoHistorico = document.getElementById('sessao-historico');
        if (sessaoHistorico && sessaoHistorico.style.display === 'block') {
            await carregarEMostrarHistorico();
        }

        renderizarEstoque();
        mostrarMensagem("Venda registrada com sucesso!");
    } catch (erro) {
        console.error("Erro ao registrar venda:", erro);
        alert("Erro ao processar a venda no banco de dados.");
    }
}

async function alterarPrecoDisco(id) {
    // 1. Encontra o disco no estoque local para saber o preço atual e o título
    const disco = estoqueVinis.find(d => d.id === id);
    if (!disco) return;

    // 2. Abre uma janela (prompt) perguntando o novo valor, já sugerindo o preço atual
    const novoPrecoTexto = prompt(`Digite o novo preço de venda para o disco "${disco.titulo}":`, disco.precoVenda);
    
    // Se o usuário clicar em "Cancelar" ou deixar em branco, interrompe a função
    if (novoPrecoTexto === null || novoPrecoTexto.trim() === "") return;

    // 3. Trata o texto digitado (substitui vírgula por ponto para o JavaScript entender)
    const novoPreco = Number(novoPrecoTexto.replace(',', '.'));

    // Validação elementar para garantir que é um número válido
    if (isNaN(novoPreco) || novoPreco < 0) {
        alert("Por favor, digite um valor numérico válido.");
        return;
    }

    try {
        // 4. Atualiza diretamente no Firebase Firestore
        const docRef = doc(db, "estoque", id); 
        await updateDoc(docRef, {
            precoVenda: novoPreco
        });

        // CORRIGIDO: Usando a função correta do seu sistema
        mostrarMensagem(`Preço atualizado para R$ ${novoPreco.toFixed(2)}!`);
        
        // 5. Atualiza o array local para refletir a mudança imediatamente na tela
        disco.precoVenda = novoPreco;
        renderizarEstoque();

    } catch (erro) {
        console.error("Erro ao atualizar o preço no Firebase:", erro);
        alert("Não foi possível salvar o novo preço no banco de dados.");
    }
}

async function removerDisco(idDisco) {
    const disco = estoqueVinis.find(d => d.id === idDisco);
    if (!disco) return;

    const motivoExclusao = prompt(`Qual o motivo de excluir o disco "${disco.titulo}" do acervo?`);
    
    // Se o usuário cancelar ou deixar em branco, não faz nada
    if (motivoExclusao === null || motivoExclusao.trim() === "") {
        mostrarMensagem("Exclusão cancelada: o motivo é obrigatório.");
        return;
    }

    if (!confirm(`Tem certeza que deseja apagar "${disco.titulo}" do sistema permanentemente?`)) return;

    try {
        // SALVA O HISTÓRICO DA EXCLUSÃO
        const registroExclusao = {
            titulo: disco.titulo || 'Sem Título',
            artista: disco.artista || 'Sem Artista',
            condicaoMidia: disco.condicaoMidia || '',
            condicaoCapa: disco.condicaoCapa || '',
            motivo: motivoExclusao,
            dataExclusao: new Date().toISOString(),
            capa: disco.capa || ''
        };
        await addDoc(colecaoExclusoes, registroExclusao);

        // Deleta de fato do estoque
        const discoRef = doc(db, "estoque", idDisco);
        await deleteDoc(discoRef);

        // Remove do array local e atualiza a tela
        estoqueVinis = estoqueVinis.filter(d => d.id !== idDisco);
        renderizarEstoque();

        mostrarMensagem("Disco removido e motivo arquivado no histórico de exclusões!");

    } catch (erro) {
        console.error("Erro ao remover disco:", erro);
        alert("Erro ao tentar remover o disco do banco de dados.");
    }
}

// ==========================================
// 12. MENSAGEM (TOAST)
// ==========================================
function mostrarMensagem(texto) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    toast.textContent = texto;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

// ==========================================
// 13. REGISTROS DE EXCLUSÃO E ESTORNO
// ==========================================
const btnToggleExclusoes = document.getElementById('btn-toggle-exclusoes');
const sessaoExclusoes = document.getElementById('sessao-exclusoes');
const listaExclusoes = document.getElementById('lista-exclusoes');

const btnToggleEstornos = document.getElementById('btn-toggle-estornos');
const sessaoEstornos = document.getElementById('sessao-estornos');
const listaEstornos = document.getElementById('lista-estornos');

// Botão de Exclusões
if (btnToggleExclusoes) {
    btnToggleExclusoes.addEventListener('click', async () => {
        if (sessaoExclusoes.style.display === 'none' || sessaoExclusoes.style.display === '') {
            sessaoExclusoes.style.display = 'block';
            btnToggleExclusoes.textContent = "Esconder Exclusões";
            await carregarExclusoes();
        } else {
            sessaoExclusoes.style.display = 'none';
            btnToggleExclusoes.textContent = "Registros de Exclusão";
        }
    });
}

// Botão de Estornos
if (btnToggleEstornos) {
    btnToggleEstornos.addEventListener('click', async () => {
        if (sessaoEstornos.style.display === 'none' || sessaoEstornos.style.display === '') {
            sessaoEstornos.style.display = 'block';
            btnToggleEstornos.textContent = "Esconder Estornos";
            await carregarEstornos();
        } else {
            sessaoEstornos.style.display = 'none';
            btnToggleEstornos.textContent = "Registros de Estorno";
        }
    });
}

// Buscar Exclusões
async function carregarExclusoes() {
    if (!listaExclusoes) return;
    listaExclusoes.innerHTML = '<p style="color: #666; font-size: 0.9rem;">Buscando registros...</p>';
    try {
        const snap = await getDocs(colecaoExclusoes);
        const registros = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        registros.sort((a, b) => new Date(b.dataExclusao) - new Date(a.dataExclusao));
        
        listaExclusoes.innerHTML = '';
        if (registros.length === 0) {
            listaExclusoes.innerHTML = '<p style="color: #666; font-size: 0.9rem;">Nenhuma exclusão registrada.</p>';
            return;
        }

        registros.forEach(reg => {
            // ADICIONADO: Formatação da data para ficar igual aos estornos
            const dataObj = new Date(reg.dataExclusao);
            const dataFormatada = dataObj.toLocaleDateString('pt-BR') + ' às ' + dataObj.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});

            const item = document.createElement('div');
item.className = 'item-historico';
item.style.display = 'flex';
item.style.alignItems = 'center';
item.style.gap = '10px';
item.style.padding = '10px';

item.innerHTML = `
    ${reg.capa ? `<img src="${reg.capa}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">` : 
                 `<div style="width: 50px; height: 50px; background: #333; border-radius: 4px;"></div>`}
    <div style="flex-grow: 1;">
        <div style="display: flex; align-items: baseline; gap: 10px; margin-bottom: 5px;">
            <strong style="color: #fff; font-size: 0.95rem;">${reg.titulo}</strong>
            <span style="color: #888; font-size: 0.7rem;">${dataFormatada}</span>
        </div>
        <div style="font-size: 0.8rem; color: #aaa; margin-bottom: 5px;">
            Mídia: <strong style="color: #4caf50;">${reg.condicaoMidia || '?'}</strong> | Capa: <strong style="color: #4caf50;">${reg.condicaoCapa || '?'}</strong>
        </div>
        <div style="font-size: 0.85rem; color: #aaa;">
            Motivo: <span style="color: #f44336; font-style: italic;">"${reg.motivo}"</span>
        </div>
    </div>
`;
listaExclusoes.appendChild(item); 
        });
    } catch (erro) {
        console.error("Erro ao carregar exclusões:", erro);
        listaExclusoes.innerHTML = '<p style="color: #f44336; font-size: 0.9rem;">Erro ao carregar os registros.</p>';
    }
}

// Buscar Estornos
async function carregarEstornos() {
    if (!listaEstornos) return;
    listaEstornos.innerHTML = '<p style="color: #666; font-size: 0.9rem;">Buscando registros...</p>';
    try {
        const snap = await getDocs(colecaoEstornos);
        const registros = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        registros.sort((a, b) => new Date(b.dataEstorno) - new Date(a.dataEstorno));
        
        listaEstornos.innerHTML = '';
        if (registros.length === 0) {
            listaEstornos.innerHTML = '<p style="color: #666; font-size: 0.9rem;">Nenhum estorno registrado.</p>';
            return;
        }

        registros.forEach(reg => {
            const dataObj = new Date(reg.dataEstorno);
            const dataFormatada = dataObj.toLocaleDateString('pt-BR') + ' às ' + dataObj.toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'});
            
            const item = document.createElement('div');
item.className = 'item-historico';
item.style.display = 'flex';
item.style.alignItems = 'center';
item.style.gap = '10px';
item.style.padding = '10px';

item.innerHTML = `
    ${reg.capa ? `<img src="${reg.capa}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 4px;">` : 
                 `<div style="width: 50px; height: 50px; background: #333; border-radius: 4px;"></div>`}
    <div style="flex-grow: 1;">
        <div style="display: flex; align-items: baseline; gap: 10px; margin-bottom: 5px;">
            <strong style="color: #fff; font-size: 0.95rem;">${reg.titulo}</strong>
            <span style="color: #888; font-size: 0.7rem;">${dataFormatada}</span>
        </div>
        <div style="font-size: 0.8rem; color: #aaa; margin-bottom: 5px;">
            Mídia: <strong style="color: #4caf50;">${reg.condicaoMidia || '-'}</strong> | Capa: <strong style="color: #4caf50;">${reg.condicaoCapa || '-'}</strong>
        </div>
        <div style="font-size: 0.85rem; color: #aaa;">
            Motivo: <span style="color: #f44336; font-style: italic;">"${reg.motivo}"</span>
        </div>
    </div>
`;
listaEstornos.appendChild(item);
        });
    } catch (erro) {
        console.error("Erro ao carregar estornos:", erro);
        listaEstornos.innerHTML = '<p style="color: #f44336; font-size: 0.9rem;">Erro ao carregar os registros.</p>';
    }
}
