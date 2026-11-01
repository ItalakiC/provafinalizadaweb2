const TAXA_ENTREGA = 15;
const LIMITE_CUPOM = 500;       // o cupom só vale para compras ACIMA desse valor
const CODIGO_CUPOM = 'GAMES10';
const DESCONTO_CUPOM = 0.10;    // 10%

const moeda = valor => valor.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const CLASSES = { 'Jogos Físicos': 'cat-jogos', 'Periféricos': 'cat-perif', 'Consoles': 'cat-consoles', 'Acessórios': 'cat-acessorios' };
const miniaturaHtml = p => `<span class="miniatura ${p.classe}" aria-hidden="true"></span>`;

function mostrarErro(caixa, mensagem) {
    caixa.textContent = mensagem;
    caixa.hidden = false;
}
function esconderErro(caixa) {
    caixa.hidden = true;
    caixa.textContent = '';
}

const armazenamento = localStorage;

function lerDados(chave, padrao) {
    const texto = armazenamento.getItem(chave);
    if (texto === null) return padrao;
    return JSON.parse(texto);
}

function salvarDados(chave, valor) {
    const texto = JSON.stringify(valor);
    armazenamento.setItem(chave, texto);
}

class Produto {
    constructor(id, nome, preco, classe) {
        this.id = id;
        this.nome = nome;
        this.preco = preco;
        this.classe = classe;
    }
}

class ItemCarrinho {
    constructor(produto, quantidade = 1) {
        this.produto = produto;
        this.quantidade = quantidade;
    }
    get subtotal() { return this.produto.preco * this.quantidade; }
}

class Carrinho {
    constructor() {
        this.itens = lerDados('carrinho', [])
            .filter(s => s.nome && s.classe)
            .map(s => new ItemCarrinho(new Produto(s.id, s.nome, s.preco, s.classe), s.quantidade));
        this.cupomAtivo = lerDados('cupom', false);
    }
    salvar() {
        salvarDados('carrinho', this.itens.map(i => ({
            id: i.produto.id, nome: i.produto.nome, preco: i.produto.preco, classe: i.produto.classe, quantidade: i.quantidade
        })));
        salvarDados('cupom', this.cupomAtivo);
    }

    adicionar(produto) {
        let item = this.itens.find(i => i.produto.id === produto.id);
        if (item) item.quantidade++;
        else {
            item = new ItemCarrinho(produto);
            this.itens.push(item);
        }
        this.salvar();
        return item;
    }

    diminuir(id) {
        const item = this.itens.find(i => i.produto.id === id);
        if (item) item.quantidade = Math.max(1, item.quantidade - 1);
        this.salvar();
    }
    remover(id) {
        this.itens = this.itens.filter(i => i.produto.id !== id);
        this.salvar();
    }
    limpar() {
        this.itens = [];
        this.cupomAtivo = false;
        this.salvar();
    }

    get quantidadeTotal() { return this.itens.reduce((soma, i) => soma + i.quantidade, 0); }
    get subtotal() { return this.itens.reduce((soma, i) => soma + i.subtotal, 0); }
    get desconto() { return this.cupomAtivo && this.subtotal > LIMITE_CUPOM ? this.subtotal * DESCONTO_CUPOM : 0; }
    get taxa() { return this.itens.length > 0 ? TAXA_ENTREGA : 0; }
    get total() { return this.subtotal - this.desconto + this.taxa; }
}

class Pedido {
    constructor(cliente, carrinho) {
        this.cliente = cliente;
        this.itens = carrinho.itens.map(i => ({
            nome: i.produto.nome, preco: i.produto.preco, quantidade: i.quantidade, subtotal: i.subtotal
        }));
        this.subtotal = carrinho.subtotal;
        this.desconto = carrinho.desconto;
        this.taxaEntrega = carrinho.taxa;
        this.total = carrinho.total;
    }
}

const carrinho = new Carrinho();

function atualizarContador() {
    document.getElementById('contadorCarrinho').textContent = carrinho.quantidadeTotal;
}
atualizarContador();

// Tema claro e escuro
document.getElementById('botaoTema').addEventListener('click', function () {
    const escuro = document.body.classList.toggle('dark-mode');
    salvarDados('tema', escuro ? 'escuro' : 'claro');
});

const temaSalvo = lerDados('tema', null);
if (temaSalvo === 'escuro' || (temaSalvo === null && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
    document.body.classList.add('dark-mode');
}

const LIMITE = 10;

const cards = Array.from(document.querySelectorAll('.bloco-produto'));
const campoBusca = document.getElementById('busca-nome');
const botoesFiltro = document.querySelectorAll('.filtro');
const semResultado = document.getElementById('sem-resultado');
const toast = document.getElementById('toast');

// Guarda a categoria ativada, inicia exibindo todas
let categoriaAtual = 'todas';

// Todo texto buscado sera tratado como minuscula
function normalizar(texto) {
    return texto.toLowerCase();
}
// Calcula e atualiza quais produtos devem aparecer na tela
function atualizarLista() {
    // Tira espaços extras nas pontas e transfoma em minuscula para o texto que for digitado na busca
    const termo = normalizar(campoBusca.value.trim());

    // Filtra os cards e retorna so os correspondentes aos filtros
    const correspondentes = cards.filter(function (card) {
        // Verifica se a categoria do card bate com a selecionada ou se esta em todas
        const categoriaOk = categoriaAtual === 'todas' || card.dataset.categoria === categoriaAtual;
        const titulo = normalizar(card.querySelector('h5').textContent);
        // Retorna verdadeira se a categoria estiver correta e o titulo tiver o termo buscado
        return categoriaOk && titulo.includes(termo);
    });

    // Percorre a lista completa de produtos para aplicar as regras de visibilidade
    cards.forEach(function (card) {
        // Descobre a posição do card dentro da lista dos cards que foram filtrados (-1 se não passou)
        const indice = correspondentes.indexOf(card);
        //Determina que o card sera visivel se passou no fitro
        const visivel = indice !== -1 && (indice < LIMITE);
        // Aplica propriedade de esconder se true e exibir se false
        card.hidden = !visivel;
    });

    // Esconde a mensagem de sem resultados se algum card foi encontrado
    semResultado.hidden = correspondentes.length > 0;
}

// Faz o evento de click individual para cada botao de categoria
botoesFiltro.forEach(function (botao) {
    botao.addEventListener('click', function () {
        // Remove a classe CSS ativo de todos os botões de filtro para desmarcar
        botoesFiltro.forEach(function (b) { b.classList.remove('ativo'); });
        // Adiciona a classe ativo ao botão que foi clicado
        botao.classList.add('ativo');
        // Lê o valor do atributo data-filtro do botão clicado e atualiza 
        categoriaAtual = botao.dataset.filtro;
        atualizarLista();
    });
});

// clicar no card (ou Enter/Espaço com ele focado) coloca o produto no carrinho
cards.forEach(function (card) {
    card.addEventListener('click', function () { escolherItem(card); });
    card.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            escolherItem(card);
        }
    });
});

// pega os dados do card e põe no carrinho
function escolherItem(card) {
    const produto = new Produto(
        Number(card.dataset.id),
        card.querySelector('h5').textContent,
        Number(card.dataset.preco),
        CLASSES[card.dataset.categoria]
    );
    const item = carrinho.adicionar(produto);
    atualizarContador();
    mostrarToast(`${produto.nome} adicionado ao carrinho (${item.quantidade}x)`);
}

let temporizadorToast;
function mostrarToast(texto) {
    toast.textContent = texto;
    toast.hidden = false;
    clearTimeout(temporizadorToast);
    temporizadorToast = setTimeout(function () { toast.hidden = true; }, 2000);
}

if (campoBusca) {
    // Pega a digitação no campo de busca em tempo real
    campoBusca.addEventListener('input', function () {
        atualizarLista();
    });
    atualizarLista();
}

// Formulário de e-mail: ao enviar só mostra o aviso e limpa o campo
const formEmail = document.getElementById('formEmail');
if (formEmail) {
    formEmail.addEventListener('submit', function (e) {
        // Previne o carregamento automatico da pagina padrão de envios de formulario
        e.preventDefault();
        mostrarToast('E-mail cadastrado! Você receberá nossas ofertas.');
        // Reseta o campo digitado pelo user
        this.reset();
    });
}

// Carrinho
const listaCarrinho = document.getElementById('listaCarrinho');
const areaCarrinho = document.getElementById('areaCarrinho');
const vazioCarrinho = document.getElementById('vazioCarrinho');
const formCupom = document.getElementById('formCupom');
const inputCupom = document.getElementById('codigoCupom');
const msgCupom = document.getElementById('msgCupom');
const formPedido = document.getElementById('formPedido');
const erroPedido = document.getElementById('erroPedido');
const inputNomeCliente = document.getElementById('nomeCliente');
const modalPedido = document.getElementById('modalPedido');

function criarCarrinho() {
    listaCarrinho.innerHTML = '';
    areaCarrinho.hidden = carrinho.itens.length === 0;
    vazioCarrinho.hidden = carrinho.itens.length > 0;

    carrinho.itens.forEach(item => {
        const p = item.produto;
        const linha = document.createElement('tr');
        linha.innerHTML = `
          <td>${miniaturaHtml(p)}</td>
          <td>${p.nome}<br><span class="preco-unit">${moeda(p.preco)} cada</span></td>
          <td>
            <button type="button" class="btn-qtd" onclick="diminuirQuantidade(${p.id})" aria-label="Diminuir quantidade de ${p.nome}" ${item.quantidade === 1 ? 'disabled' : ''}>−</button>
            <span class="qtd-badge">${item.quantidade}</span>
          </td>
          <td>${moeda(item.subtotal)}</td>
          <td>
            <button type="button" class="btn-remover" onclick="removerItem(${p.id})" aria-label="Remover ${p.nome}">Remover</button>
          </td>`;
        listaCarrinho.appendChild(linha);
    });

    atualizarTotais();
}

function mostrarMensagemCupom(texto, ok) {
    msgCupom.textContent = texto;
    msgCupom.className = ok ? 'msg-ok' : 'msg-erro';
    msgCupom.hidden = false;
}

function atualizarTotais() {
    if (carrinho.cupomAtivo && carrinho.subtotal <= LIMITE_CUPOM) {
        carrinho.cupomAtivo = false;
        carrinho.salvar();
        mostrarMensagemCupom(`Cupom removido: só vale para compras acima de ${moeda(LIMITE_CUPOM)}.`, false);
    } else if (carrinho.cupomAtivo) {
        mostrarMensagemCupom(`Cupom ${CODIGO_CUPOM} aplicado: 10% de desconto.`, true);
    } else {
        msgCupom.hidden = true;
    }

    document.getElementById('subtotal').textContent = moeda(carrinho.subtotal);
    document.getElementById('desconto').textContent = '- ' + moeda(carrinho.desconto);
    document.getElementById('linhaDesconto').hidden = carrinho.desconto === 0;
    document.getElementById('taxaEntrega').textContent = moeda(carrinho.taxa);
    document.getElementById('valorTotal').textContent = moeda(carrinho.total);
    atualizarContador();
}

function diminuirQuantidade(id) {
    carrinho.diminuir(id);
    criarCarrinho();
}

function removerItem(id) {
    carrinho.remover(id);
    criarCarrinho();
}

if (formPedido) {
    formCupom.addEventListener('submit', function (evento) {
        evento.preventDefault();
        const codigo = inputCupom.value.trim().toUpperCase();

        if (codigo !== CODIGO_CUPOM) {
            mostrarMensagemCupom('Cupom inválido.', false);
        } else if (carrinho.subtotal <= LIMITE_CUPOM) {
            mostrarMensagemCupom(`O cupom só vale para compras acima de ${moeda(LIMITE_CUPOM)}.`, false);
        } else {
            carrinho.cupomAtivo = true;
            carrinho.salvar();
            inputCupom.value = '';
            criarCarrinho();
        }
    });

    formPedido.addEventListener('submit', function (evento) {
        evento.preventDefault();
        esconderErro(erroPedido);

        const cliente = { nome: inputNomeCliente.value.trim() };

        let erro = null;
        if (carrinho.itens.length === 0) erro = 'O carrinho está vazio';
        else if (cliente.nome.length < 3) erro = 'Informe o nome do cliente (mínimo 3 letras)';

        if (erro) {
            mostrarErro(erroPedido, erro);
            return;
        }

        const pedido = new Pedido(cliente, carrinho);
        console.log(pedido);
        mostrarResumo(pedido);

        carrinho.limpar();
        formPedido.reset();
        criarCarrinho();
    });

    document.getElementById('botaoFechar').addEventListener('click', function () {
        modalPedido.close();
    });

    criarCarrinho();
}

function mostrarResumo(p) {
    const itens = p.itens.map(i => `<li>${i.quantidade}x ${i.nome} — ${moeda(i.subtotal)}</li>`).join('');
    const desconto = p.desconto > 0 ? `<br>Desconto (cupom): - ${moeda(p.desconto)}` : '';

    document.getElementById('resumoPedido').innerHTML = `
      <p>Cliente: <strong id="clienteResumo"></strong></p>
      <ul>${itens}</ul>
      <p>Subtotal: ${moeda(p.subtotal)}${desconto}<br>Taxa de entrega: ${moeda(p.taxaEntrega)}</p>
      <p class="total-resumo">Valor Total: ${moeda(p.total)}</p>`;
    document.getElementById('clienteResumo').textContent = p.cliente.nome;
    modalPedido.showModal();
}