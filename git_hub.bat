@echo off
:: Desabilita a exibição dos comandos no terminal para uma saída mais limpa

echo Iniciando sincronizacao com o Git...

:: Adiciona todas as alterações (git add .)
echo.
echo [1/3] Adicionando arquivos...
git add .
if %errorlevel% neq 0 (
    echo Erro ao adicionar arquivos.
    pause
    exit /b %errorlevel%
)

:: Realiza o commit com a mensagem padrão
echo.
echo [2/3] Realizando commit...
git commit -m "Corrigindo sincronizacao"
if %errorlevel% neq 0 (
    echo Nada para commitar ou erro no commit.
    pause
    exit /b %errorlevel%
)

:: Envia as alterações para o repositório remoto
echo.
echo [3/3] Enviando para o servidor (Push)...
git push
if %errorlevel% neq 0 (
    echo Erro ao enviar para o servidor.
    pause
    exit /b %errorlevel%
)

echo.
echo Sincronizacao concluida com sucesso!
echo.
pause