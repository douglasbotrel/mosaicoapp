#!/bin/sh
# copia módulos compartilhados do app para a central (central fica autônoma)
cd "$(dirname "$0")/.." && for f in schema core validar csv pacote tiles; do cp app/js/$f.js central/lib/$f.js; done
printf 'window.MOSAICO_PARQUES_FULL=' > central/lib/parques_full.js && cat tools/parques_full.geojson >> central/lib/parques_full.js && printf ';\n' >> central/lib/parques_full.js && echo sincronizado
