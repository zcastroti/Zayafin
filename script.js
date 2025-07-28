document.addEventListener('DOMContentLoaded', () => {
    // --- Referências aos elementos do DOM ---
    const adicionarContaBtn = document.getElementById('adicionarConta');
    const overlayForm = document.getElementById('overlayForm');
    const cancelarAdicaoBtn = document.getElementById('cancelarAdicao');
    const formAdicionarConta = document.getElementById('formAdicionarConta');
    const corpoTabelaContas = document.getElementById('corpoTabelaContas');

    const contaIdInput = document.getElementById('contaId');
    const nomeContaInput = document.getElementById('nomeConta');
    const valorContaInput = document.getElementById('valorConta');
    const vencimentoContaInput = document.getElementById('vencimentoConta');
    const statusContaSelect = document.getElementById('statusConta');

    const totalPendenteSpan = document.getElementById('totalPendente');
    const totalPagoSpan = document.getElementById('totalPago');

    const btnSalvarAdicao = document.getElementById('btnSalvarAdicao');
    const btnGravarEdicao = document.getElementById('btnGravarEdicao');
    const btnExcluirConta = document.getElementById('btnExcluirConta');
    const tituloFormulario = overlayForm.querySelector('h2');

    // --- Array para armazenar as contas (será preenchido pelo Firestore) ---
    let contas = [];
    // O 'proximoId' não será mais necessário, pois o Firestore gera IDs automaticamente.

    // --- Variáveis para Drag and Drop ---
    let draggedItem = null;

    // --- Funções de Manipulação de Dados e DOM ---

    /**
     * @function carregarContasIniciais
     * @description Agora, esta função carregará os dados do Firestore.
     * A linha estática do HTML foi removida, pois todos os dados virão do DB.
     */
    async function carregarContasIniciais() {
        // Remove qualquer linha estática que possa ter no HTML (se ainda existir)
        const primeiraLinhaEstatica = corpoTabelaContas.querySelector('tr');
        if (primeiraLinhaEstatica) {
            primeiraLinhaEstatica.remove();
        }

        contas = []; // Limpa o array local antes de carregar do Firestore
        try {
            // Obter todos os documentos da coleção 'contas'
            const snapshot = await db.collection('contas').orderBy('timestamp', 'asc').get();
            snapshot.forEach(doc => {
                const data = doc.data();
                // Adiciona a conta ao array local, usando o ID do Firestore
                contas.push({
                    id: doc.id, // O ID do documento do Firestore
                    descricao: data.descricao,
                    valor: data.valor,
                    vencimento: data.vencimento,
                    status: data.status,
                    // O timestamp não é necessário no objeto local, mas é útil para ordenação no Firestore
                });
            });
            renderizarContas(); // Renderiza as contas carregadas do Firestore
        } catch (error) {
            console.error("Erro ao carregar contas do Firestore:", error);
            alert("Erro ao carregar contas. Verifique sua conexão ou as regras do Firestore.");
        }
    }

    /**
     * @function renderizarContas
     * @description Limpa a tabela e renderiza todas as contas do array 'contas'.
     * Adiciona os event listeners para edição e Drag and Drop.
     */
    function renderizarContas() {
        corpoTabelaContas.innerHTML = '';

        contas.forEach(conta => {
            const newRow = corpoTabelaContas.insertRow();
            newRow.setAttribute('data-id', conta.id);
            newRow.setAttribute('draggable', 'true');

            // Adiciona event listeners para Drag and Drop
            newRow.addEventListener('dragstart', handleDragStart);
            newRow.addEventListener('dragover', handleDragOver);
            newRow.addEventListener('dragleave', handleDragLeave);
            newRow.addEventListener('drop', handleDrop);
            newRow.addEventListener('dragend', handleDragEnd);

            const descricaoCell = newRow.insertCell();
            descricaoCell.classList.add('col-descricao');
            descricaoCell.textContent = conta.descricao;

            const valorCell = newRow.insertCell();
            valorCell.classList.add('col-valor');
            // Garante que o valor é um número antes de formatar
            valorCell.textContent = parseFloat(conta.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

            const vencimentoCell = newRow.insertCell();
            vencimentoCell.classList.add('col-vencimento');
            // Certifique-se de que a data está no formato YYYY-MM-DD para criar o objeto Date
            const dataVencimento = new Date(conta.vencimento + 'T00:00:00'); 
            vencimentoCell.textContent = dataVencimento.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

            const statusCell = newRow.insertCell();
            statusCell.classList.add('col-status');
            statusCell.textContent = conta.status;
            if (conta.status === 'Pendente') {
                statusCell.classList.add('statusPendente');
            } else if (conta.status === 'Pago') {
                statusCell.classList.add('statusPago');
            }

            const acaoCell = newRow.insertCell();
            acaoCell.classList.add('col-acao');
            const engrenagemBtn = document.createElement('input');
            engrenagemBtn.type = 'button';
            engrenagemBtn.value = '⚙';
            engrenagemBtn.classList.add('botaoEngrenagem');
            engrenagemBtn.setAttribute('data-id', conta.id);
            
            engrenagemBtn.addEventListener('click', (event) => {
                const idContaParaEditar = event.target.getAttribute('data-id'); // ID já é string do Firestore
                abrirQuadroEditar(idContaParaEditar);
            });
            acaoCell.appendChild(engrenagemBtn);
        });
        atualizarTotais();
    }

    /**
     * @function atualizarTotais
     * @description Calcula e atualiza os valores de Total Pendente e Total Pago.
     */
    function atualizarTotais() {
        let totalPendente = 0;
        let totalPago = 0;

        contas.forEach(conta => {
            const valor = parseFloat(conta.valor);
            if (conta.status === 'Pendente') {
                totalPendente += valor;
            } else if (conta.status === 'Pago') {
                totalPago += valor;
            }
        });

        totalPendenteSpan.textContent = totalPendente.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
        totalPagoSpan.textContent = totalPago.toLocaleString('pt-BR', {
            style: 'currency',
            currency: 'BRL'
        });
    }

    // --- Funções do Quadro Modal (Adicionar/Editar) ---

    /**
     * @function abrirQuadroAdicionar
     * @description Abre o formulário para adicionar uma nova conta, mostrando os botões corretos.
     */
    function abrirQuadroAdicionar() {
        tituloFormulario.textContent = 'Adicionar Nova Conta';
        contaIdInput.value = '';
        formAdicionarConta.reset();

        btnSalvarAdicao.style.display = 'inline-block';
        btnGravarEdicao.style.display = 'none';
        btnExcluirConta.style.display = 'none';

        overlayForm.style.display = 'flex';
    }

    /**
     * @function abrirQuadroEditar
     * @description Abre o formulário para editar uma conta existente, preenchendo os campos.
     * @param {string} idConta - O ID (string) da conta a ser editada no Firestore.
     */
    function abrirQuadroEditar(idConta) {
        // Encontra a conta no array local pelo ID do Firestore
        const contaParaEditar = contas.find(conta => conta.id === idConta);

        if (contaParaEditar) {
            tituloFormulario.textContent = 'Editar Conta';
            contaIdInput.value = contaParaEditar.id;
            nomeContaInput.value = contaParaEditar.descricao;
            valorContaInput.value = parseFloat(contaParaEditar.valor);
            vencimentoContaInput.value = contaParaEditar.vencimento; // Formato YYYY-MM-DD
            statusContaSelect.value = contaParaEditar.status;

            btnSalvarAdicao.style.display = 'none';
            btnGravarEdicao.style.display = 'inline-block';
            btnExcluirConta.style.display = 'inline-block';

            overlayForm.style.display = 'flex';
        } else {
            console.error('Conta não encontrada para edição (ID:', idConta, ')');
            alert('Conta não encontrada para edição.');
        }
    }

    /**
     * @function fecharQuadroAdicionar
     * @description Fecha o overlay e o formulário de adição/edição de conta.
     */
    function fecharQuadroAdicionar() {
        overlayForm.style.display = 'none';
        formAdicionarConta.reset();
        contaIdInput.value = '';
    }

    /**
     * @function adicionarOuAtualizarContaFirestore
     * @description Adiciona uma nova conta ou atualiza uma existente no Firestore.
     * @param {Event} event - O evento de submissão do formulário.
     */
    async function adicionarOuAtualizarContaFirestore(event) {
        event.preventDefault();

        const idConta = contaIdInput.value; // Pega o ID (se estiver editando)
        const dataConta = {
            descricao: nomeContaInput.value,
            valor: parseFloat(valorContaInput.value).toFixed(2), // Salva como string ou número com 2 casas
            vencimento: vencimentoContaInput.value,
            status: statusContaSelect.value,
            timestamp: firebase.firestore.FieldValue.serverTimestamp() // Adiciona um timestamp para ordenação
        };

        try {
            if (idConta) {
                // Modo de Edição: Atualiza o documento existente
                await db.collection('contas').doc(idConta).update(dataConta);
                alert('Conta atualizada com sucesso!');
            } else {
                // Modo de Adição: Adiciona um novo documento
                await db.collection('contas').add(dataConta);
                alert('Conta adicionada com sucesso!');
            }
            await carregarContasIniciais(); // Recarrega e re-renderiza do Firestore
            fecharQuadroAdicionar();
        } catch (error) {
            console.error("Erro ao salvar/atualizar conta no Firestore:", error);
            alert("Erro ao salvar/atualizar conta. Verifique sua conexão ou as regras do Firestore.");
        }
    }

    /**
     * @function excluirContaFirestore
     * @description Exclui uma conta do Firestore após confirmação.
     */
    async function excluirContaFirestore() {
        const idDaContaExcluir = contaIdInput.value; // ID do Firestore
        const contaParaExcluir = contas.find(conta => conta.id === idDaContaExcluir);

        if (contaParaExcluir) {
            const confirmacao = confirm(`Tem certeza que deseja excluir a conta "${contaParaExcluir.descricao}"?`);

            if (confirmacao) {
                try {
                    await db.collection('contas').doc(idDaContaExcluir).delete();
                    alert('Conta excluída com sucesso!');
                    await carregarContasIniciais(); // Recarrega e re-renderiza do Firestore
                    fecharQuadroAdicionar();
                } catch (error) {
                    console.error("Erro ao excluir conta do Firestore:", error);
                    alert("Erro ao excluir conta. Verifique sua conexão ou as regras do Firestore.");
                }
            }
        } else {
            console.error('Erro: Conta não encontrada para exclusão (ID:', idDaContaExcluir, ')');
            alert('Conta não encontrada para exclusão.');
        }
    }

    // --- Funções de Drag and Drop ---

    /**
     * @function handleDragStart
     * @description Lida com o início do arraste de uma linha.
     * @param {Event} e - O evento de arrastar.
     */
    function handleDragStart(e) {
        draggedItem = this; // 'this' se refere à linha (tr) que está sendo arrastada
        e.dataTransfer.effectAllowed = 'move'; // Define o tipo de efeito (movimento)
        e.dataTransfer.setData('text/plain', this.dataset.id); // Armazena o ID da conta arrastada (ID do Firestore)
        this.classList.add('is-dragging'); // Adiciona classe para feedback visual
    }

    /**
     * @function handleDragOver
     * @description Lida com o arraste de um item sobre outro elemento.
     * Impede o comportamento padrão para permitir o 'drop'.
     * @param {Event} e - O evento de arrastar.
     */
    function handleDragOver(e) {
        e.preventDefault(); // Necessário para permitir o drop
        if (this.dataset.id !== draggedItem.dataset.id) { // Evita arrastar sobre si mesmo
            // Remove a classe 'drag-over' de qualquer outro item para evitar múltiplos feedbacks
            document.querySelectorAll('.drag-over').forEach(item => item.classList.remove('drag-over'));
            this.classList.add('drag-over'); // Adiciona classe para feedback visual (onde será solto)
        }
        e.dataTransfer.dropEffect = 'move'; // Define o efeito visual do cursor
    }

    /**
     * @function handleDragLeave
     * @description Lida com a saída do arraste de um item de um elemento.
     * Remove o feedback visual.
     * @param {Event} e - O evento de arrastar.
     */
    function handleDragLeave(e) {
        this.classList.remove('drag-over'); // Remove o feedback visual
    }

    /**
     * @function handleDrop
     * @description Lida com a soltura de um item em um elemento.
     * Reorganiza o array de contas local e chama a re-renderização.
     * NOTA: A reordenação no Firestore é mais complexa e geralmente envolve campos de "ordem"
     * ou "índice" nos documentos. Para este exemplo, estamos apenas reordenando a exibição local.
     * Para persistir a ordem, você precisaria atualizar os "timestamps" ou adicionar um novo campo
     * "orderIndex" em cada documento afetado e depois ordenar por ele.
     * @param {Event} e - O evento de arrastar.
     */
    async function handleDrop(e) {
        e.preventDefault();
        this.classList.remove('drag-over');

        if (this.dataset.id === draggedItem.dataset.id) {
            return;
        }

        const draggedId = draggedItem.dataset.id;
        const targetId = this.dataset.id;

        const draggedIndex = contas.findIndex(c => c.id === draggedId);
        const targetIndex = contas.findIndex(c => c.id === targetId);

        if (draggedIndex !== -1 && targetIndex !== -1) {
            const [removed] = contas.splice(draggedIndex, 1);
            contas.splice(targetIndex, 0, removed);
            
            renderizarContas(); // Re-renderiza a tabela com a nova ordem local

            // --- Persistir a nova ordem no Firestore (opcional, mais complexo) ---
            // Para persistir a ordem no Firestore, você precisaria adicionar um campo
            // como 'orderIndex' a cada documento e, após a reordenação local,
            // iterar sobre o array 'contas' e atualizar o 'orderIndex' de cada documento
            // no Firestore. O 'carregarContasIniciais' precisaria ordenar por 'orderIndex'.
            // Exemplo conceitual (não implementado totalmente aqui para simplificar):
            // for (let i = 0; i < contas.length; i++) {
            //     await db.collection('contas').doc(contas[i].id).update({ orderIndex: i });
            // }
            // Para um D&D robusto com persistência de ordem, você precisaria
            // de uma estratégia mais elaborada para gerenciar o campo 'orderIndex'
            // sem muitas operações de escrita no banco de dados.
            // Para este exemplo, a ordem é apenas visual após o drop.
        }
    }

    /**
     * @function handleDragEnd
     * @description Lida com o término do arraste.
     * Limpa as classes de feedback visual.
     * @param {Event} e - O evento de arrastar.
     */
    function handleDragEnd(e) {
        this.classList.remove('is-dragging');
        document.querySelectorAll('.drag-over').forEach(item => item.classList.remove('drag-over'));
        draggedItem = null;
    }


    // --- Event Listeners Globais ---

    adicionarContaBtn.addEventListener('click', abrirQuadroAdicionar);
    cancelarAdicaoBtn.addEventListener('click', fecharQuadroAdicionar);
    overlayForm.addEventListener('click', (event) => {
        if (event.target === overlayForm) { 
            fecharQuadroAdicionar();
        }
    });

    // Modifica o listener de submit para usar a nova função que interage com Firestore
    formAdicionarConta.addEventListener('submit', adicionarOuAtualizarContaFirestore);

    // Modifica os listeners de "Gravar" e "Excluir" para usar as novas funções do Firestore
    btnGravarEdicao.addEventListener('click', adicionarOuAtualizarContaFirestore); // Reutiliza a função de submit
    btnExcluirConta.addEventListener('click', excluirContaFirestore);


    // --- Inicialização da Aplicação ---
    carregarContasIniciais(); // Carrega as contas do Firestore ao iniciar
});