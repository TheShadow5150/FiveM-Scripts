shared_script '@WaveShield/resource/include.lua'

fx_version 'cerulean'
game 'gta5'
lua54 'yes'

name 'qbx_multijob'
description 'QBX Infinite Jobs System synced for Infin8 QBX + Jaksam inventory + ox_lib'
author 'Infin8 patch over original'
version '1.2.0-infin8-qbx-jaksam'

shared_scripts {
    '@ox_lib/init.lua',
    'shared/config.lua',
    'shared/infin8_jobs.lua',
}

client_scripts {
    'client/main.lua',
    'client/ui.lua',
    'client/announce.lua',
    'client/announce_nui.lua',
}

server_scripts {
    '@oxmysql/lib/MySQL.lua',
    'server/sv_framework.lua',
    'server/sv_inventory.lua',
    'server/main.lua',
    'server/infin8_authority_ext.lua',
    'server/sv_announce.lua',
    'server/callbacks.lua',
}

ui_page 'html/index.html'

files {
    'html/index.html',
    'html/css/style.css',
    'html/js/app.js',
}

dependencies {
    'qbx_core',
    'ox_lib',
    'oxmysql',
}

-- Optional but supported when enabled in shared/config.lua:
-- ox_target, jaksam_inventory
