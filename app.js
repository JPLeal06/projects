// ==========================================
// 1. IMPORTAÇÕES OBRIGATÓRIAS (TOPO ABSOLUTO)
// ==========================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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
const docTotais = doc(db, "relatorios", "totais");

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
    try {
        listaHistorico.innerHTML = '<p style="color: #666; font-size: 0.9rem;">Buscando vendas no banco de dados...</p>';
        
        const snapVendas = await getDocs(colecaoVendas);
        let vendasArray = snapVendas.docs.map(d => ({ id: d.id, ...d.data() }));
        
        vendasArray.sort((a, b) => new Date(b.data) - new Date(a.data));

        if (vendasArray.length === 0) {
            listaHistorico.innerHTML = '<p style="color: #666; font-size: 0.9rem;">Nenhuma venda registrada ainda.</p>';
            return;
        }

        listaHistorico.innerHTML = ''; 

        vendasArray.forEach(venda => {
            const dataObj = new Date(venda.data);
            const dataFormatada = dataObj.toLocaleDateString('pt-BR') + ' às ' + dataObj.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
            
            const valorVenda = Number(venda.venda || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
            const lucroVenda = Number((venda.venda || 0) - (venda.custo || 0)).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

            const item = document.createElement('div');
            item.className = 'item-historico';
            
            item.innerHTML = `
                <div style="display: flex; justify-content: space-between; margin-bottom: 5px;">
                    <strong style="color: #fff; font-size: 0.95rem;">${venda.titulo || 'Disco sem título'}</strong>
                    <span style="color: #888; font-size: 0.8rem;">${dataFormatada}</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem;">
                    <div>
                        <span style="color: #aaa;">Venda: <strong style="color: #fff;">${valorVenda}</strong></span> |
                        <span style="color: #aaa;">Lucro: <strong style="color: #4caf50;">${lucroVenda}</strong></span>
                    </div>
                    <button class="btn-estornar" data-id="${venda.id}" style="background: #d32f2f; color: white; border: none; padding: 5px 10px; border-radius: 4px; font-size: 0.75rem; cursor: pointer; font-weight: bold; transition: 0.2s;">Estornar</button>
                </div>
            `;
            listaHistorico.appendChild(item);
        });

        document.querySelectorAll('.btn-estornar').forEach(btn => {
            btn.addEventListener('click', (e) => estornarVenda(e.target.dataset.id));
        });

    } catch (erro) {
        console.error("Erro ao carregar histórico:", erro);
        listaHistorico.innerHTML = '<p style="color: #f44336; font-size: 0.9rem;">Erro ao carregar o histórico.</p>';
    }
}

async function estornarVenda(idVenda) {
    if (!confirm("Deseja realmente estornar esta venda? O valor cobrado será subtraído das finanças e 1 unidade voltará ao estoque.")) return;

    try {
        const vendaRef = doc(db, "vendas", idVenda);
        const snapVenda = await getDoc(vendaRef);
        
        if (!snapVenda.exists()) {
            alert("Venda não encontrada ou já estornada.");
            return;
        }
        const dadosVenda = snapVenda.data();

        await deleteDoc(vendaRef);

        const snapTotais = await getDoc(docTotais);
        if (snapTotais.exists()) {
            const totaisAtuais = snapTotais.data();
            const novosTotais = {
                faturamento: Math.max(0, Number(totaisAtuais.faturamento || 0) - Number(dadosVenda.venda || 0)),
                custo: Math.max(0, Number(totaisAtuais.custo || 0) - Number(dadosVenda.custo || 0)),
                qtdVendas: Math.max(0, Number(totaisAtuais.qtdVendas || 0) - 1)
            };
            await setDoc(docTotais, novosTotais);
            
            const novoLucro = novosTotais.faturamento - novosTotais.custo;
            atualizarDashboard(novosTotais.faturamento, novosTotais.custo, novoLucro, novosTotais.qtdVendas);
        }

        const discoNoEstoque = estoqueVinis.find(d => (d.titulo || "").toLowerCase() === (dadosVenda.titulo || "").toLowerCase());
        
        if (discoNoEstoque) {
            const discoRef = doc(db, "estoque", discoNoEstoque.id);
            const novaQtd = (discoNoEstoque.quantidade || 0) + 1;
            
            await updateDoc(discoRef, { quantidade: novaQtd });
            
            discoNoEstoque.quantidade = novaQtd;
            renderizarEstoque();
            mostrarMensagem("Venda desfeita e unidade devolvida ao estoque!");
        } else {
            mostrarMensagem("Venda removida das finanças! (O disco não voltou ao estoque porque foi excluído da loja).");
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

// Elementos da Paginação
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

// Digitação no campo de busca
if (inputModalDiscogs) {
    inputModalDiscogs.addEventListener('input', (e) => {
        termoBuscaAtual = e.target.value.trim();
        paginaAtualDiscogs = 1; // Sempre volta para a página 1 numa busca nova
        
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

// Botões de Navegação (Página Anterior e Próxima)
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

// Função de Busca Principal Adaptada
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
                // PEGA TODOS OS GÊNEROS AQUI
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
// 7. CARREGAMENTO E DASHBOARD
// ==========================================
async function carregarDados() {
    try {
        const snapshotEstoque = await getDocs(colecaoEstoque);
        estoqueVinis = snapshotEstoque.docs.map(d => ({ id: d.id, ...d.data() }));

        await carregarTotais();
        renderizarEstoque();
    } catch (erro) {
        console.error("Erro ao carregar dados:", erro);
        const tabela = document.getElementById('tabela-estoque');
        if(tabela) tabela.innerHTML = '<tr><td colspan="6" class="esgotado">Erro ao conectar com o banco de dados.</td></tr>';
    }
}

async function carregarTotais() {
    try {
        const snap = await getDoc(docTotais);
        if (snap.exists()) {
            const { faturamento = 0, custo = 0, qtdVendas = 0 } = snap.data();
            const lucro = faturamento - custo; 
            atualizarDashboard(faturamento, custo, lucro, qtdVendas); 
        } else {
            await recalcularTotais();
        }
    } catch (erro) {
        console.error("Erro ao carregar totais:", erro);
    }
}

async function recalcularTotais() {
    try {
        const snapshotVendas = await getDocs(colecaoVendas);
        let faturamento = 0, custo = 0;
        
        snapshotVendas.forEach(d => {
            faturamento += Number(d.data().venda || 0);
            custo += Number(d.data().custo || 0);
        });
        
        const qtdVendas = snapshotVendas.size;
        const lucro = faturamento - custo; 
        
        await setDoc(docTotais, { faturamento, custo, qtdVendas });
        atualizarDashboard(faturamento, custo, lucro, qtdVendas);
    } catch(erro) {
        console.error("Erro ao recalcular:", erro);
    }
}

function atualizarDashboard(faturamento, custo, lucro, qtdVendas) {
    const els = {
        'valor-faturamento': faturamento,
        'valor-custo': custo,
        'valor-lucro': lucro
    };
    
    for (const [id, valor] of Object.entries(els)) {
        const el = document.getElementById(id);
        if (el) el.textContent = Number(valor).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }
    
    const elQtd = document.getElementById('qtd-vendas');
    if (elQtd) elQtd.textContent = qtdVendas;
}

// ==========================================
// 8. RENDERIZAÇÃO DA TABELA DE ESTOQUE
// ==========================================
function renderizarEstoque() {
    const tabela = document.getElementById('tabela-estoque');
    if (!tabela) return;
    
    tabela.innerHTML = '';

    // 1. Filtra Textualmente
    let discosParaExibir = estoqueVinis.filter(disco => {
        const titulo = (disco.titulo || "").toLowerCase();
        const artista = (disco.artista || "").toLowerCase();
        return titulo.includes(termoFiltroEstoque) || artista.includes(termoFiltroEstoque);
    });

    // 2. Ordena
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
        const precoFormatado = Number(disco.precoVenda || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        
        let statusEstoque = '';
        if (disco.quantidade === 0) {
            statusEstoque = '<span class="esgotado">Esgotado</span>';
        } else {
            statusEstoque = disco.quantidade;
        }

        const imgCapa = disco.capa 
            ? `<img src="${disco.capa}" style="width: 55px; height: 55px; object-fit: cover; border-radius: 4px; box-shadow: 0 2px 5px rgba(0,0,0,0.5);">` 
            : `<div style="width: 55px; height: 55px; background: #333; border-radius: 4px; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 10px;">Sem Capa</div>`;

        // SEPARA OS GÊNEROS E CRIA MÚLTIPLOS BADGES AQUI
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
            <td data-label="Preço">${precoFormatado}</td>
            <td data-label="Ações">
                <div class="acoes-tabela">
                    <button class="btn-acao btn-vender ${disco.quantidade === 0 ? 'btn-disabled' : ''}"
                            data-id="${disco.id}"
                            ${disco.quantidade === 0 ? 'disabled' : ''}>Vender</button>
                    ${btnDiscogsHtml}
                    <button class="btn-acao btn-remover" data-id="${disco.id}">Excluir</button>
                </div>
            </td>
        `;
        tabela.appendChild(linha);
    });

    document.querySelectorAll('.btn-vender').forEach(btn => {
        btn.addEventListener('click', (e) => venderDisco(e.target.dataset.id));
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
            data: new Date().toISOString()
        };
        await addDoc(colecaoVendas, novaVenda);

        const snapTotais = await getDoc(docTotais);
        const totaisAtuais = snapTotais.exists() ? snapTotais.data() : { faturamento: 0, custo: 0, qtdVendas: 0 };
        
        const novosTotais = {
            faturamento: Number(totaisAtuais.faturamento || 0) + Number(disco.precoVenda || 0),
            custo: Number(totaisAtuais.custo || 0) + Number(disco.precoCusto || 0),
            qtdVendas: Number(totaisAtuais.qtdVendas || 0) + 1
        };
        
        await setDoc(docTotais, novosTotais);

        estoqueVinis[discoIndex].quantidade -= 1;
        
        const novoLucro = novosTotais.faturamento - novosTotais.custo;
        atualizarDashboard(novosTotais.faturamento, novosTotais.custo, novoLucro, novosTotais.qtdVendas);
        
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

// ==========================================
// 11. EXCLUIR DISCO DO ESTOQUE
// ==========================================
async function removerDisco(idDisco) {
    if (confirm('Tem certeza que deseja remover este disco permanentemente do estoque?')) {
        try {
            await deleteDoc(doc(db, "estoque", idDisco));
            estoqueVinis = estoqueVinis.filter(d => d.id !== idDisco);
            renderizarEstoque();
            mostrarMensagem("Disco removido.");
        } catch (erro) {
            console.error("Erro ao excluir:", erro);
            alert("Erro ao excluir o disco do banco de dados.");
        }
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
