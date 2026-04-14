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

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, getDocs, doc, updateDoc, deleteDoc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const colecaoEstoque = collection(db, "estoque");
const colecaoVendas = collection(db, "vendas");
const docTotais = doc(db, "relatorios", "totais");

let estoqueVinis = [];

// ─── Discogs: mostra lista de resultados pra escolher ───────────────────────

document.getElementById('btn-buscar-discogs').addEventListener('click', async () => {
    const termoBusca = document.getElementById('input-discogs').value.trim();
    const btn = document.getElementById('btn-buscar-discogs');

    if (!termoBusca) {
        alert("Digite o nome de um álbum ou artista para buscar.");
        return;
    }

    btn.textContent = "Buscando...";
    btn.disabled = true;

    try {
        const url = `https://api.discogs.com/database/search?q=${encodeURIComponent(termoBusca)}&type=release&format=vinyl&per_page=5&token=${DISCOGS_TOKEN}`;
        const resposta = await fetch(url);
        const dados = await resposta.json();

        if (dados.results && dados.results.length > 0) {
            mostrarResultadosDiscogs(dados.results.slice(0, 5));
        } else {
            alert("Nenhum disco encontrado com esse nome no Discogs.");
        }
    } catch (erro) {
        console.error("Erro no Discogs:", erro);
        alert("Erro ao buscar no Discogs. Verifique seu token e conexão.");
    } finally {
        btn.textContent = "Buscar Dados";
        btn.disabled = false;
    }
});

function mostrarResultadosDiscogs(resultados) {
    // Remove lista anterior se existir
    const listaAnterior = document.getElementById('lista-discogs');
    if (listaAnterior) listaAnterior.remove();

    const lista = document.createElement('div');
    lista.id = 'lista-discogs';
    lista.className = 'lista-discogs';

    resultados.forEach((resultado) => {
        const partesTitulo = resultado.title.split(' - ');
        const artista = partesTitulo[0] || '';
        const titulo = partesTitulo[1] || resultado.title;
        const ano = resultado.year ? ` (${resultado.year})` : '';

        const item = document.createElement('div');
        item.className = 'discogs-item';
        item.textContent = `${resultado.title}${ano}`;

        item.addEventListener('click', () => {
            document.getElementById('titulo').value = titulo.trim();
            document.getElementById('artista').value = artista.trim();
            lista.remove();
            mostrarMensagem("🎵 Selecionado: " + resultado.title);
        });

        lista.appendChild(item);
    });

    // Insere a lista abaixo do campo de busca
    const buscaDiscogs = document.querySelector('.busca-discogs');
    buscaDiscogs.insertAdjacentElement('afterend', lista);
}

// Fecha lista de resultados ao clicar fora
document.addEventListener('click', (e) => {
    const lista = document.getElementById('lista-discogs');
    if (lista && !lista.contains(e.target) && e.target.id !== 'btn-buscar-discogs') {
        lista.remove();
    }
});

// ─── Carregamento de dados ────────────────────────────────────────────────────

async function carregarDados() {
    try {
        const snapshotEstoque = await getDocs(colecaoEstoque);
        estoqueVinis = snapshotEstoque.docs.map(d => ({ id: d.id, ...d.data() }));

        await carregarTotais();
        renderizarEstoque();
    } catch (erro) {
        console.error("Erro ao carregar dados:", erro);
        document.getElementById('tabela-estoque').innerHTML =
            '<tr><td colspan="5" class="esgotado">Erro ao conectar com o banco de dados.</td></tr>';
    }
}

// ─── Totais incrementais (evita ler todas as vendas a cada load) ──────────────

async function carregarTotais() {
    try {
        const snap = await getDoc(docTotais);
        if (snap.exists()) {
            const { faturamento = 0, custo = 0, qtdVendas = 0 } = snap.data();
            atualizarDashboard(faturamento, faturamento - custo, qtdVendas);
        } else {
            // Primeira vez: migra somando todas as vendas existentes
            await recalcularTotais();
        }
    } catch (erro) {
        console.error("Erro ao carregar totais:", erro);
    }
}

async function recalcularTotais() {
    const snapshotVendas = await getDocs(colecaoVendas);
    let faturamento = 0, custo = 0;
    snapshotVendas.forEach(d => {
        faturamento += Number(d.data().venda);
        custo += Number(d.data().custo);
    });
    const qtdVendas = snapshotVendas.size;
    await setDoc(docTotais, { faturamento, custo, qtdVendas });
    atualizarDashboard(faturamento, faturamento - custo, qtdVendas);
}

function atualizarDashboard(faturamento, lucro, qtdVendas) {
    document.getElementById('valor-faturamento').textContent =
        Number(faturamento).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('valor-lucro').textContent =
        Number(lucro).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    document.getElementById('qtd-vendas').textContent = qtdVendas;
}

// ─── Renderização do estoque ──────────────────────────────────────────────────

function renderizarEstoque() {
    const tabela = document.getElementById('tabela-estoque');
    tabela.innerHTML = '';

    if (estoqueVinis.length === 0) {
        tabela.innerHTML = '<tr><td colspan="5" class="empty-message">Nenhum disco no estoque.</td></tr>';
        return;
    }

    estoqueVinis.forEach((disco) => {
        const linha = document.createElement('tr');
        const precoFormatado = Number(disco.precoVenda).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
        const statusEstoque = disco.quantidade > 0
            ? disco.quantidade
            : '<span class="esgotado">Esgotado</span>';

        linha.innerHTML = `
            <td data-label="Título">${disco.titulo}</td>
            <td data-label="Artista">${disco.artista}</td>
            <td data-label="Estoque">${statusEstoque}</td>
            <td data-label="Preço">${precoFormatado}</td>
            <td data-label="Ações">
                <button class="btn-vender ${disco.quantidade === 0 ? 'btn-disabled' : ''}"
                        data-id="${disco.id}"
                        ${disco.quantidade === 0 ? 'disabled' : ''}>Vender</button>
                <button class="btn-remover" data-id="${disco.id}">Excluir</button>
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

// ─── Adicionar disco ──────────────────────────────────────────────────────────

document.getElementById('form-disco').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btnSalvar = document.getElementById('btn-salvar');
    btnSalvar.textContent = "Salvando...";
    btnSalvar.disabled = true;

    const titulo = document.getElementById('titulo').value.trim();
    const artista = document.getElementById('artista').value.trim();

    // Verifica duplicata
    const duplicata = estoqueVinis.find(
        d => d.titulo.toLowerCase() === titulo.toLowerCase() &&
             d.artista.toLowerCase() === artista.toLowerCase()
    );

    if (duplicata) {
        if (!confirm(`"${titulo}" de ${artista} já está no estoque. Deseja adicionar mesmo assim?`)) {
            btnSalvar.textContent = "Salvar no Estoque";
            btnSalvar.disabled = false;
            return;
        }
    }

    const novoDisco = {
        titulo,
        artista,
        quantidade: parseInt(document.getElementById('quantidade').value),
        precoCusto: parseFloat(document.getElementById('preco-custo').value),
        precoVenda: parseFloat(document.getElementById('preco-venda').value)
    };

    try {
        const docRef = await addDoc(colecaoEstoque, novoDisco);
        estoqueVinis.push({ id: docRef.id, ...novoDisco });
        renderizarEstoque();
        document.getElementById('form-disco').reset();
        document.getElementById('input-discogs').value = '';
        mostrarMensagem("Disco adicionado ao estoque!");
    } catch (erro) {
        console.error("Erro ao salvar:", erro);
        alert("Erro ao salvar o disco no banco de dados.");
    } finally {
        btnSalvar.textContent = "Salvar no Estoque";
        btnSalvar.disabled = false;
    }
});

// ─── Vender disco ─────────────────────────────────────────────────────────────

async function venderDisco(idDisco) {
    const discoIndex = estoqueVinis.findIndex(d => d.id === idDisco);
    const disco = estoqueVinis[discoIndex];

    if (!disco || disco.quantidade <= 0) return;

    try {
        // Atualiza estoque
        const discoRef = doc(db, "estoque", idDisco);
        await updateDoc(discoRef, { quantidade: disco.quantidade - 1 });

        // Registra venda
        const novaVenda = {
            titulo: disco.titulo,
            custo: disco.precoCusto,
            venda: disco.precoVenda,
            data: new Date().toISOString()
        };
        await addDoc(colecaoVendas, novaVenda);

        // Atualiza totais incrementalmente
        const snapTotais = await getDoc(docTotais);
        const totaisAtuais = snapTotais.exists() ? snapTotais.data() : { faturamento: 0, custo: 0, qtdVendas: 0 };
        const novosTotais = {
            faturamento: totaisAtuais.faturamento + disco.precoVenda,
            custo: totaisAtuais.custo + disco.precoCusto,
            qtdVendas: totaisAtuais.qtdVendas + 1
        };
        await setDoc(docTotais, novosTotais);

        // Atualiza estado local
        estoqueVinis[discoIndex].quantidade -= 1;
        atualizarDashboard(novosTotais.faturamento, novosTotais.faturamento - novosTotais.custo, novosTotais.qtdVendas);
        renderizarEstoque();
        mostrarMensagem("Venda registrada!");
    } catch (erro) {
        console.error("Erro ao registrar venda:", erro);
        alert("Erro ao processar a venda no banco de dados.");
    }
}

// ─── Remover disco ────────────────────────────────────────────────────────────

async function removerDisco(idDisco) {
    if (confirm('Tem certeza que deseja remover este disco permanentemente?')) {
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

// ─── Toast ────────────────────────────────────────────────────────────────────

function mostrarMensagem(texto) {
    const toast = document.getElementById('toast');
    toast.textContent = texto;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

// ─── Init ─────────────────────────────────────────────────────────────────────

carregarDados();
