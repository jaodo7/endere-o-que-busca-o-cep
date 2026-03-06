document.addEventListener('DOMContentLoaded', function() {
    
    // Elementos do DOM
    const ufSelect = document.getElementById('uf');
    const cidadeSelect = document.getElementById('cidade');
    const logradouroInput = document.getElementById('logradouro');
    const btnBuscar = document.getElementById('btnBuscar');
    const loadingDiv = document.getElementById('loading');
    const resultadosLista = document.getElementById('resultadosLista');
    const erroSpan = document.getElementById('erro');
    
    // Histórico de buscas
    let historico = JSON.parse(localStorage.getItem('historicoCepPorEndereco')) || [];

    // Variáveis de estado
    let cidades = [];
    let buscaAtual = null;

    // Quando o estado for selecionado, buscar cidades
    ufSelect.addEventListener('change', function() {
        const uf = this.value;
        
        if (uf) {
            buscarCidades(uf);
        } else {
            cidadeSelect.innerHTML = '<option value="">Primeiro selecione o estado</option>';
            cidadeSelect.disabled = true;
            logradouroInput.disabled = true;
            logradouroInput.value = '';
            btnBuscar.disabled = true;
        }
    });

    // Quando a cidade for selecionada, habilitar logradouro
    cidadeSelect.addEventListener('change', function() {
        if (this.value) {
            logradouroInput.disabled = false;
            logradouroInput.focus();
        } else {
            logradouroInput.disabled = true;
            logradouroInput.value = '';
            btnBuscar.disabled = true;
        }
    });

    // Habilitar/desabilitar botão de busca conforme digitação
    logradouroInput.addEventListener('input', function() {
        btnBuscar.disabled = !(this.value.length >= 3);
    });

    // Permitir buscar com Enter
    logradouroInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter' && !btnBuscar.disabled) {
            buscarCEPs();
        }
    });

    // Evento de clique no botão
    btnBuscar.addEventListener('click', buscarCEPs);

    // Função para buscar cidades do estado
    async function buscarCidades(uf) {
        mostrarLoading(true, 'Carregando cidades...');
        erroSpan.textContent = '';
        
        try {
            // Usar API do IBGE para buscar cidades
            const response = await fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`);
            const data = await response.json();
            
            cidades = data.sort((a, b) => a.nome.localeCompare(b.nome));
            
            // Preencher select de cidades
            cidadeSelect.innerHTML = '<option value="">Selecione a cidade</option>';
            cidades.forEach(cidade => {
                const option = document.createElement('option');
                option.value = cidade.nome;
                option.textContent = cidade.nome;
                cidadeSelect.appendChild(option);
            });
            
            cidadeSelect.disabled = false;
            mostrarLoading(false);
            
        } catch (error) {
            erroSpan.textContent = 'Erro ao carregar cidades. Tente novamente.';
            console.error('Erro:', error);
            mostrarLoading(false);
        }
    }

    // Função para buscar CEPs pelo endereço
    async function buscarCEPs() {
        const uf = ufSelect.value;
        const cidade = cidadeSelect.value;
        const logradouro = logradouroInput.value.trim();
        
        // Validações
        if (!uf) {
            erroSpan.textContent = 'Selecione o estado';
            return;
        }
        
        if (!cidade) {
            erroSpan.textContent = 'Selecione a cidade';
            return;
        }
        
        if (logradouro.length < 3) {
            erroSpan.textContent = 'Digite pelo menos 3 caracteres do logradouro';
            return;
        }
        
        // Limpar resultados anteriores
        resultadosLista.innerHTML = '';
        erroSpan.textContent = '';
        
        // Mostrar loading
        mostrarLoading(true, 'Buscando CEPs...');
        
        try {
            // Buscar CEPs na API ViaCEP
            const response = await fetch(`https://viacep.com.br/ws/${uf}/${cidade}/${encodeURIComponent(logradouro)}/json/`);
            const data = await response.json();
            
            if (data.length === 0) {
                resultadosLista.innerHTML = '<div class="sem-resultados">Nenhum CEP encontrado para este endereço</div>';
            } else {
                exibirResultados(data);
                salvarNoHistorico(uf, cidade, logradouro, data);
            }
            
        } catch (error) {
            erroSpan.textContent = 'Erro ao buscar CEPs. Tente novamente.';
            console.error('Erro:', error);
        } finally {
            mostrarLoading(false);
        }
    }

    // Função para exibir os resultados
    function exibirResultados(resultados) {
        resultadosLista.innerHTML = '';
        
        // Limitar a 10 resultados para não poluir a tela
        const resultadosLimitados = resultados.slice(0, 10);
        
        resultadosLimitados.forEach(endereco => {
            const div = document.createElement('div');
            div.className = 'resultado-item';
            
            div.innerHTML = `
                <div class="resultado-cep">${endereco.cep}</div>
                <div class="resultado-endereco">
                    <strong>${endereco.logradouro}</strong><br>
                    ${endereco.bairro ? `Bairro: ${endereco.bairro}<br>` : ''}
                    ${endereco.complemento ? `Complemento: ${endereco.complemento}<br>` : ''}
                    ${endereco.localidade}/${endereco.uf}
                </div>
            `;
            
            // Ao clicar no resultado, copiar CEP
            div.addEventListener('click', () => {
                navigator.clipboard.writeText(endereco.cep).then(() => {
                    alert(`CEP ${endereco.cep} copiado para a área de transferência!`);
                });
            });
            
            div.style.cursor = 'pointer';
            div.title = 'Clique para copiar o CEP';
            
            resultadosLista.appendChild(div);
        });
        
        if (resultados.length > 10) {
            const info = document.createElement('div');
            info.className = 'sem-resultados';
            info.textContent = `Mostrando 10 de ${resultados.length} resultados encontrados`;
            resultadosLista.appendChild(info);
        }
    }

    // Função para mostrar/esconder loading
    function mostrarLoading(mostrar, mensagem = 'Buscando...') {
        if (mostrar) {
            loadingDiv.style.display = 'block';
            loadingDiv.textContent = mensagem;
            resultadosLista.style.display = 'none';
            btnBuscar.disabled = true;
        } else {
            loadingDiv.style.display = 'none';
            resultadosLista.style.display = 'flex';
            btnBuscar.disabled = false;
        }
    }

    // Função para salvar no histórico
    function salvarNoHistorico(uf, cidade, logradouro, resultados) {
        const busca = {
            uf: uf,
            cidade: cidade,
            logradouro: logradouro,
            totalResultados: resultados.length,
            primeirosCeps: resultados.slice(0, 3).map(r => r.cep).join(', '),
            timestamp: new Date().toLocaleString()
        };
        
        historico.unshift(busca);
        
        if (historico.length > 10) {
            historico.pop();
        }
        
        localStorage.setItem('historicoCepPorEndereco', JSON.stringify(historico));
        exibirHistorico();
    }

    // Função para exibir histórico
    function exibirHistorico() {
        const listaHistorico = document.getElementById('listaHistorico');
        if (!listaHistorico) return;
        
        listaHistorico.innerHTML = '';
        
        if (historico.length === 0) {
            listaHistorico.innerHTML = '<li style="color: #718096;">Nenhuma busca realizada</li>';
            return;
        }
        
        historico.forEach((busca, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <strong>${busca.logradouro}</strong> - ${busca.cidade}/${busca.uf}<br>
                <small>${busca.totalResultados} CEP encontrados • ${busca.timestamp}</small>
                ${busca.primeirosCeps ? `<br><small>📌 ${busca.primeirosCeps}</small>` : ''}
            `;
            
            // Ao clicar no histórico, preencher os campos
            li.addEventListener('click', () => {
                ufSelect.value = busca.uf;
                // Disparar evento change para carregar cidades
                const event = new Event('change');
                ufSelect.dispatchEvent(event);
                
                // Aguardar cidades carregarem e selecionar a cidade
                setTimeout(() => {
                    cidadeSelect.value = busca.cidade;
                    logradouroInput.value = busca.logradouro;
                    logradouroInput.disabled = false;
                    btnBuscar.disabled = false;
                    
                    // Rolar até o formulário
                    document.querySelector('.search-box').scrollIntoView({ behavior: 'smooth' });
                }, 500);
            });
            
            listaHistorico.appendChild(li);
        });
    }

    // Função para limpar histórico
    function limparHistorico() {
        if (confirm('Deseja limpar todo o histórico?')) {
            historico = [];
            localStorage.removeItem('historicoCepPorEndereco');
            exibirHistorico();
        }
    }

    // Inicializar histórico
    exibirHistorico();
    
    // Adicionar botão de limpar histórico
    const historyBox = document.querySelector('.history-box');
    if (historyBox) {
        const clearButton = document.createElement('button');
        clearButton.textContent = 'Limpar Histórico';
        clearButton.style.cssText = `
            margin-top: 10px;
            padding: 8px 15px;
            background: #e53e3e;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            font-size: 14px;
            width: 100%;
            transition: background 0.3s;
        `;
        clearButton.addEventListener('mouseenter', () => {
            clearButton.style.background = '#c53030';
        });
        clearButton.addEventListener('mouseleave', () => {
            clearButton.style.background = '#e53e3e';
        });
        clearButton.addEventListener('click', limparHistorico);
        historyBox.appendChild(clearButton);
    }
});