# app/seeds/produtos_data.py

# Cole aqui os produtos no formato: TIPO \t NOME \t VALOR
# Você pode ir adicionando linha por linha.

PRODUTOS_TSV = """
PORTAL\tConteúdo Informativo de Opinião Completa (Digital + DOOH + Rádio)\tR$ 120.000,00
PORTAL\tConteúdo Informativo de Opinião Digital\tR$ 80.000,00
PORTAL\tConteúdo de Marca (Matéria Patrocinada)\tR$ 50.000,00
PORTAL\tManchete\tR$ 70.000,00
PORTAL\tSub-manchete\tR$ 50.000,00
PORTAL\tBig Talk\tR$ 300.000,00
PORTAL\tOne Talk\tR$ 200.000,00
PORTAL\tLittle Talk\tR$ 85.000,00
PORTAL\tInstagram Post Fixado Feed ou Reels\tR$ 3.000,00
PORTAL\tPost Instagram Feed + Stories\tR$ 25.000,00
PORTAL\tPost Instagram Reels + Stories\tR$ 25.000,00
PORTAL\tPost Youtube Shorts\tR$ 25.000,00
PORTAL\tPost TikTok\tR$ 25.000,00
PORTAL\tPost Kwai\tR$ 25.000,00
PORTAL\tPost Feed Facebook\tR$ 25.000,00
PORTAL\tSocial Video Testemunhal\tR$ 38.000,00
PORTAL\tVídeo React\tR$ 10.000,00
PORTAL\tDiária de Banner Retângulo 300x250px\tR$ 30.000,00
PORTAL\tCPM de Banner Retângulo 300x250px\tR$ 80,00
PORTAL\tDiária de Banner Half Page 300x600px\tR$ 15.000,00
PORTAL\tCPM de Banner Half Page 300x600px\tR$ 80,00
PORTAL\tDiária de Banner Billboard 970x250px\tR$ 15.000,00
PORTAL\tCPM de Banner Billboard 970x250px\tR$ 80,00
PORTAL\tDiária de Super Banner 728x90px\tR$ 15.000,00
PORTAL\tCPM de Super Banner 728x90px\tR$ 80,00
PORTAL\tDiária de Super Leaderboard 970x90px\tR$ 15.000,00
PORTAL\tCPM de Super Leaderboard 970x90px\tR$ 80,00
PORTAL\tDiária de Banner Mobile 320x50px (topo)\tR$ 30.000,00
PORTAL\tCPM de Banner Mobile 320x50px (topo)\tR$ 80,00
PORTAL\tDiária de Banner Mobile 320x50px (ancorado)\tR$ 30.000,00
PORTAL\tCPM de Banner Mobile 320x50px (ancorado)\tR$ 80,00
PORTAL\tMensal - Selo no Cabeçalho da Editoria 120x50px\tR$ 50.000,00
PORTAL\tDiária de Envelopamento Site - Formato Especial\tR$ 130.000,00
PAINEL\tDiária - Painel Empena Setor Bancário 246m²\tR$ 10.000,00
PAINEL\tSemanal - Painel Empena Setor Bancário 246m²\tR$ 65.000,00
PAINEL\tQuinzenal - Painel Empena Setor Bancário 246m²\tR$ 105.000,00
PAINEL\tMensal - Painel Empena Setor Bancário 246m²\tR$ 190.000,00
PAINEL\tDiária - Painel JK (face 1) 66m²\tR$ 4.000,00
PAINEL\tSemanal - Painel JK (face 1) 66m²\tR$ 20.000,00
PAINEL\tQuinzenal - Painel JK (face 1) 66m²\tR$ 35.000,00
PAINEL\tMensal - Painel JK (face 1) 66m²\tR$ 65.000,00
PAINEL\tDiária - Painel JK (face 2) 66m²\tR$ 4.000,00
PAINEL\tSemanal - Painel JK (face 2) 66m²\tR$ 20.000,00
PAINEL\tQuinzenal - Painel JK (face 2) 66m²\tR$ 35.000,00
PAINEL\tMensal - Painel JK (face 2) 66m²\tR$ 65.000,00
PAINEL\tDiária - Painel JK (face 3) 43m²\tR$ 4.000,00
PAINEL\tSemanal - Painel JK (face 3) 43m²\tR$ 20.000,00
PAINEL\tQuinzenal - Painel JK (face 3) 43m²\tR$ 35.000,00
PAINEL\tMensal - Painel JK (face 3) 43m²\tR$ 65.000,00
PAINEL\tDiária - Painel Saída Norte 66m²\tR$ 4.000,00
PAINEL\tSemanal - Painel Saída Norte 66m²\tR$ 20.000,00
PAINEL\tQuinzenal - Painel Saída Norte 66m²\tR$ 35.000,00
PAINEL\tMensal - Painel Saída Norte 66m²\tR$ 65.000,00
PAINEL\tDiária - Painel SIA/EPTG 66m²\tR$ 4.000,00
PAINEL\tSemanal - Painel SIA/EPTG 66m²\tR$ 20.000,00
PAINEL\tQuinzenal - Painel SIA/EPTG 66m²\tR$ 35.000,00
PAINEL\tMensal - Painel SIA/EPTG 66m²\tR$ 65.000,00
PAINEL\tDiária - Painel Estrutural Face 1 66m²\tR$ 4.000,00
PAINEL\tSemanal - Painel Estrutural (face 1) 66m²\tR$ 20.000,00
PAINEL\tQuinzenal - Painel Estrutural (face 1) 66m²\tR$ 35.000,00
PAINEL\tMensal - Painel Estrutural (face 1) 66m²\tR$ 65.000,00
PAINEL\tDiária - Painel Estrutural (face 2) 66m²\tR$ 4.000,00
PAINEL\tSemanal - Painel Estrutural (face 2) 66m²\tR$ 20.000,00
PAINEL\tQuinzenal - Painel Estrutural (face 2) 66m²\tR$ 35.000,00
PAINEL\tMensal - Painel Estrutural (face 2) 66m²\tR$ 65.000,00
PAINEL\tDiária - Painel Estrutural (face 3) 66m²\tR$ 4.000,00
PAINEL\tSemanal - Painel Estrutural (face 3) 66m²\tR$ 20.000,00
PAINEL\tQuinzenal - Painel Estrutural (face 3) 66m²\tR$ 35.000,00
PAINEL\tMensal - Painel Estrutural (face 3) 66m²\tR$ 65.000,00
PAINEL\tDiária - Painel EPIA Sul 66m²\tR$ 4.000,00
PAINEL\tSemanal - Painel EPIA Sul 66m²\tR$ 20.000,00
PAINEL\tQuinzenal - Painel EPIA Sul 66m²\tR$ 35.000,00
PAINEL\tMensal - Painel EPIA Sul 66m²\tR$ 65.000,00
PAINEL\tDiária - Painel EPNB 66m²\tR$ 4.000,00
PAINEL\tSemanal - Painel EPNB 66m²\tR$ 20.000,00
PAINEL\tQuinzenal - Painel EPNB 66m²\tR$ 35.000,00
PAINEL\tMensal - Painel EPNB 66m²\tR$ 65.000,00
PAINEL\tDiária - Painel W3 NORTE - QUADRA 505/705 7,4m²\tR$ 2.400,00
PAINEL\tSemanal - Painel W3 NORTE - QUADRA 505/705 7,4m²\tR$ 12.000,00
PAINEL\tQuinzenal - Painel W3 NORTE - QUADRA 505/705 7,4m²\tR$ 21.000,00
PAINEL\tMensal - Painel W3 NORTE - QUADRA 505/705 7,4m²\tR$ 39.000,00
PAINEL\tDiária - Painel TAGUATINGA NORTE - AVENIDA HÉLIO PRATES 7,4m²\tR$ 2.400,00
PAINEL\tSemanal - Painel TAGUATINGA NORTE - AVENIDA HÉLIO PRATES 7,4m²\tR$ 12.000,00
PAINEL\tQuinzenal - Painel TAGUATINGA NORTE - AVENIDA HÉLIO PRATES 7,4m²\tR$ 21.000,00
PAINEL\tMensal - Painel TAGUATINGA NORTE - AVENIDA HÉLIO PRATES 7,4m²\tR$ 39.000,00
PAINEL\tDiária - Painel ÁGUAS CLARAS - Av. das Castanheiras rua 33/34 7,4m²\tR$ 2.400,00
PAINEL\tSemanal - Painel ÁGUAS CLARAS - Av. das Castanheiras rua 33/34 7,4m²\tR$ 12.000,00
PAINEL\tQuinzenal - Painel ÁGUAS CLARAS - Av. das Castanheiras rua 33/34 7,4m²\tR$ 21.000,00
PAINEL\tMensal - Painel ÁGUAS CLARAS - Av. das Castanheiras rua 33/34 7,4m²\tR$ 39.000,00
PAINEL\tDiária - Painel ÁGUAS CLARAS - Av. das Castanheiras Lt 01, 02 7,4m²\tR$ 2.400,00
PAINEL\tSemanal - Painel ÁGUAS CLARAS - Av. das Castanheiras Lt 01, 02 7,4m²\tR$ 12.000,00
PAINEL\tQuinzenal - Painel ÁGUAS CLARAS - Av. das Castanheiras Lt 01, 02 7,4m²\tR$ 21.000,00
PAINEL\tMensal - Painel ÁGUAS CLARAS - Av. das Castanheiras Lt 01, 02 7,4m²\tR$ 39.000,00
PAINEL\tDiária - PAINEL SETOR DE CLUBES LAGO SUL - Via L2 Sul - 7,4m²\tR$ 2.400,00
PAINEL\tSemanal - PAINEL SETOR DE CLUBES LAGO SUL - Via L2 Sul - 7,4m²\tR$ 12.000,00
PAINEL\tQuinzenal - PAINEL SETOR DE CLUBES LAGO SUL - Via L2 Sul - 7,4m²\tR$ 21.000,00
PAINEL\tMensal - PAINEL SETOR DE CLUBES LAGO SUL - Via L2 Sul - 7,4m²\tR$ 39.000,00
PAINEL\tDiária - PAINEL L2 SUL - QUADRA SGAS 616 - Via L2 Sul - 7,4m²\tR$ 2.400,00
PAINEL\tSemanal - PAINEL L2 SUL - QUADRA SGAS 616 - Via L2 Sul - 7,4m²\tR$ 12.000,00
PAINEL\tQuinzenal - PAINEL L2 SUL - QUADRA SGAS 616 - Via L2 Sul - 7,4m²\tR$ 21.000,00
PAINEL\tMensal - PAINEL L2 SUL - QUADRA SGAS 616 - Via L2 Sul - 7,4m²\tR$ 39.000,00
PAINEL\tDiária - PAINEL Setor Hoteleiro Norte (Face 1) - 7,4m²\tR$ 2.400,00
PAINEL\tSemanal - PAINEL Setor Hoteleiro Norte (Face 1) - 7,4m²\tR$ 12.000,00
PAINEL\tQuinzenal - PAINEL Setor Hoteleiro Norte (Face 1) - 7,4m²\tR$ 21.000,00
PAINEL\tMensal - PAINEL Setor Hoteleiro Norte (Face 1) - 7,4m²\tR$ 39.000,00
PAINEL\tDiária - PAINEL Setor Hoteleiro Norte (Face 2) - 7,4m²\tR$ 2.400,00
PAINEL\tSemanal - PAINEL Setor Hoteleiro Norte (Face 2) - 7,4m²\tR$ 12.000,00
PAINEL\tQuinzenal - PAINEL Setor Hoteleiro Norte (Face 2) - 7,4m²\tR$ 21.000,00
PAINEL\tMensal - PAINEL Setor Hoteleiro Norte (Face 2) - 7,4m²\tR$ 39.000,00
PAINEL\tCIRCUITO MUB LAGO SUL / EPDB - 34 FACES\tR$ 50.320,00
PAINEL\tCIRCUITO MUB VIA EPIG / SIG - 3 FACES\tR$ 4.440,00
PAINEL\tCIRCUITO MUB VIA EPNB - 31 FACES\tR$ 45.880,00
PAINEL\tCIRCUITO MUB LAGO NORTE / EPPR - 17 FACES\tR$ 25.160,00
PAINEL\tCIRCUITO MUB VIA EPGU - 8 FACES\tR$ 11.840,00
PAINEL\tCIRCUITO MUB VIA PISTÃO SUL TAGUATINGA - 11 FACES\tR$ 16.280,00
PAINEL\tCIRCUITO MUB VIA PISTÃO NORTE TAGUATINGA - 09 FACES\tR$ 13.320,00
PAINEL\tCIRCUITO MUB VIA L4 SUL - 22 FACES\tR$ 32.560,00
PAINEL\tCIRCUITO MUB VIA L4 NORTE - 18 FACES\tR$ 26.640,00
PAINEL\tCIRCUITO MUB SETOR NOROESTE - 16 FACES\tR$ 23.680,00
PAINEL\tDiária - Painel ESTÁDIO - PGR / PAL.BURITI (FACE 1) 16,6m²\tR$ 2.400,00
PAINEL\tSemanal - Painel ESTÁDIO - PGR / PAL.BURITI (FACE 1) 16,6m²\tR$ 12.000,00
PAINEL\tQuinzenal - Painel ESTÁDIO - PGR / PAL.BURITI (FACE 1) 16,6m²\tR$ 21.000,00
PAINEL\tMensal - Painel ESTÁDIO - PGR / PAL.BURITI (FACE 1) 16,6m²\tR$ 39.000,00
PAINEL\tDiária - Painel ESTÁDIO - PGR / PAL.BURITI (FACE 2) 16,6m²\tR$ 2.400,00
PAINEL\tSemanal - Painel ESTÁDIO - PGR / PAL.BURITI (FACE 2) 16,6m²\tR$ 12.000,00
PAINEL\tQuinzenal - Painel ESTÁDIO - PGR / PAL.BURITI (FACE 2) 16,6m²\tR$ 21.000,00
PAINEL\tMensal - Painel ESTÁDIO - PGR / PAL.BURITI (FACE 2) 16,6m²\tR$ 39.000,00
PAINEL\tDiária - Painel ESTÁDIO - Rotatória acesso Asa Norte 16,6m²\tR$ 2.400,00
PAINEL\tSemanal - Painel ESTÁDIO - Rotatória acesso Asa Norte 16,6m²\tR$ 12.000,00
PAINEL\tQuinzenal - Painel ESTÁDIO - Rotatória acesso Asa Norte 16,6m²\tR$ 21.000,00
PAINEL\tMensal - Painel ESTÁDIO - Rotatória acesso Asa Norte 16,6m²\tR$ 39.000,00
PAINEL\tDiária - Painel ESTÁDIO - Colégio Militar (face 1) 16,6m²\tR$ 2.400,00
PAINEL\tSemanal - Painel ESTÁDIO - Colégio Militar (face 1) 16,6m²\tR$ 12.000,00
PAINEL\tQuinzenal - Painel ESTÁDIO - Colégio Militar (face 1) 16,6m²\tR$ 21.000,00
PAINEL\tMensal - Painel ESTÁDIO - Colégio Militar (face 1) 16,6m²\tR$ 39.000,00
PAINEL\tDiária - Painel ESTÁDIO - Colégio Militar (face 2) 16,6m²\tR$ 2.400,00
PAINEL\tSemanal - Painel ESTÁDIO - Colégio Militar (face 2) 16,6m²\tR$ 12.000,00
PAINEL\tQuinzenal - Painel ESTÁDIO - Colégio Militar (face 2) 16,6m²\tR$ 21.000,00
PAINEL\tMensal - Painel ESTÁDIO - Colégio Militar (face 2) 16,6m²\tR$ 39.000,00
RÁDIO\tSpot - 5 seg - Determinado\tR$ 197,50
RÁDIO\tSpot - 5 seg - Rotativo (7h às 19h)\tR$ 122,50
RÁDIO\tSpot - 5 seg - Indeterm (5h às 21h)\tR$ 78,00
RÁDIO\tSpot - 10 seg - Determinado\tR$ 395,00
RÁDIO\tSpot - 10 seg - Rotativo (7h às 19h)\tR$ 245,00
RÁDIO\tSpot - 10 seg - Indeterm (5h às 21h)\tR$ 156,00
RÁDIO\tSpot - 15 seg - Determinado\tR$ 553,00
RÁDIO\tSpot - 15 seg - Rotativo (7h às 19h)\tR$ 343,00
RÁDIO\tSpot - 15 seg - Indeterm (5h às 21h)\tR$ 218,00
RÁDIO\tSpot - 30 seg - Determinado\tR$ 790,00
RÁDIO\tSpot - 30 seg - Rotativo (7h às 19h)\tR$ 490,00
RÁDIO\tSpot - 30 seg - Indeterm (5h às 21h)\tR$ 312,00
RÁDIO\tSpot - 45 seg - Determinado\tR$ 1.185,00
RÁDIO\tSpot - 45 seg - Rotativo (7h às 19h)\tR$ 735,00
RÁDIO\tSpot - 45 seg - Indeterm (5h às 21h)\tR$ 468,00
RÁDIO\tSpot - 60 seg - Determinado\tR$ 1.580,00
RÁDIO\tSpot - 60 seg - Rotativo (7h às 19h)\tR$ 980,00
RÁDIO\tSpot - 60 seg - Indeterm (5h às 21h)\tR$ 624,00
RÁDIO\tParadinha Doblô ou UP - 2 horas - 4 flashs de 60"\tR$ 5.720,00
RÁDIO\tParadinha Ônibus Estúdio Móvel - 2 horas - 4 flashs de 60"\tR$ 8.900,00
RÁDIO\tFlash ao Vivo - Determinado (informar horário)\tR$ 2.200,00
RÁDIO\tTestemunhal Ao Vivo 30 seg - Hor Determinado (informar horário)\tR$ 1.580,00
RÁDIO\tTestemunhal Ao Vivo 30 seg - Hor Rotativo (07h às 19h)\tR$ 980,00
RÁDIO\tTestemunhal Ao Vivo 30 seg - Hor Indeterminado (05h às 21h)\tR$ 624,00
RÁDIO\tTestemunhal Ao Vivo 45 seg - Hor Determinado (informar horário)\tR$ 2.370,00
RÁDIO\tTestemunhal Ao Vivo 45 seg - Hor Rotativo (07h às 19h)\tR$ 1.470,00
RÁDIO\tTestemunhal Ao Vivo 45 seg - Hor Indeterminado (05h às 21h)\tR$ 936,00
RÁDIO\tTestemunhal Ao Vivo 60 seg - Hor Determinado (informar horário)\tR$ 3.160,00
RÁDIO\tTestemunhal Ao Vivo 60 seg - Hor Rotativo (07h -às 19h)\tR$ 1.960,00
RÁDIO\tTestemunhal Ao Vivo 60 seg - Hor Indeterminado (05h às 21h)\tR$ 1.248,00
RÁDIO\tCachê de locutor - Gravação ou flash externo ou testemunhal\tR$ 100,00
RÁDIO\tPatrocínio de programa - Abertura 5" Hor determinado\tR$ 197,50
RÁDIO\tPatrocínio de programa - Encerramento 5" Hor determinado\tR$ 197,50
RÁDIO\tPatrocínio de programa - Spot colado 30" Hor determinado\tR$ 790,00
RÁDIO\tMomento X - Programate 45" - Hor Determinado\tR$ 1.185,00
RÁDIO\tMomento X - Programate 45" - Hor Rotativo\tR$ 735,00
RÁDIO\tMinuto Dica - Programate 60" - Hor Determinado\tR$ 1.580,00
RÁDIO\tMinuto Dica - Programate 60" - Hor Rotativo\tR$ 980,00









































































































































































""".strip()
