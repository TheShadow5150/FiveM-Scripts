-- ╔══════════════════════════════════════════════════════════════╗
-- ║     qbx_multijob — Business Announcements (Server)          ║
-- ║  Only Owner / Manager / Chief grade names may broadcast.    ║
-- ║  Hard 30-minute cooldown per player (not per job).          ║
-- ╚══════════════════════════════════════════════════════════════╝

local COOLDOWN_MS   = 30 * 60 * 1000  -- 30 minutes in milliseconds
local MAX_MSG_LEN   = 300
local MIN_MSG_LEN   = 5

-- Authorised grade name fragments (case-insensitive, substring match)
local ALLOWED_GRADES = { 'owner', 'manager', 'chief' }

-- Tracks last announce timestamp per source (reset on resource stop/restart)
local cooldowns = {}

-- ── Helpers ────────────────────────────────────────────────────

local function notify(src, msg, ntype)
    TriggerClientEvent('ox_lib:notify', src, {
        title       = 'Business Announcements',
        description = msg,
        type        = ntype or 'info',
        duration    = 5000,
        icon        = 'bullhorn',
    })
end

local function isAllowedGrade(gradeName)
    local lower = tostring(gradeName or ''):lower()
    for _, keyword in ipairs(ALLOWED_GRADES) do
        if lower:find(keyword, 1, true) then
            return true
        end
    end
    return false
end

-- Returns remaining cooldown in seconds, or 0 if ready.
local function getCooldownRemaining(src)
    local last = cooldowns[src]
    if not last then return 0 end
    local elapsed = GetGameTimer() - last
    if elapsed >= COOLDOWN_MS then return 0 end
    return math.ceil((COOLDOWN_MS - elapsed) / 1000)
end

-- ── Callback ───────────────────────────────────────────────────

lib.callback.register('qbx_multijob:server:SendAnnouncement', function(src, message)
    -- Basic input sanity
    if type(message) ~= 'string' then
        return false, 'Invalid message.'
    end
    message = message:match('^%s*(.-)%s*$') -- trim whitespace
    if #message < MIN_MSG_LEN then
        return false, ('Announcement must be at least %d characters.'):format(MIN_MSG_LEN)
    end
    if #message > MAX_MSG_LEN then
        return false, ('Announcement cannot exceed %d characters.'):format(MAX_MSG_LEN)
    end

    -- Cooldown check
    local remaining = getCooldownRemaining(src)
    if remaining > 0 then
        local mins = math.floor(remaining / 60)
        local secs = remaining % 60
        local timeStr = mins > 0
            and ('%d min %d sec'):format(mins, secs)
            or  ('%d sec'):format(secs)
        return false, ('You must wait %s before sending another announcement.'):format(timeStr)
    end

    -- Fetch player's active multijob row to check grade
    local player = Infin8Multijob.GetPlayer(src)
    if not player then
        return false, 'Unable to verify your identity.'
    end
    local citizenid = Infin8Multijob.GetCitizenId(player)
    if not citizenid then
        return false, 'Unable to verify your identity.'
    end

    local activeRow = MySQL.query.await(
        'SELECT * FROM `player_multijobs` WHERE `citizenid` = ? AND `is_active` = 1 LIMIT 1',
        { citizenid }
    ) or {}
    local row = activeRow[1]

    if not row then
        return false, 'You do not have an active job.'
    end

    if not isAllowedGrade(row.grade_name) then
        return false, ('Only Owner, Manager, or Chief may send business announcements. Your current grade is: %s'):format(row.grade_name or 'Unknown')
    end

    -- All checks passed — stamp cooldown and broadcast
    cooldowns[src] = GetGameTimer()

    local senderName = GetPlayerName(src) or 'Unknown'
    -- Try to get character name from player data
    local charName = (player.PlayerData and player.PlayerData.charinfo and
        (player.PlayerData.charinfo.firstname .. ' ' .. player.PlayerData.charinfo.lastname))
        or senderName

    local payload = {
        jobLabel  = row.job_label or row.job_name,
        gradeName = row.grade_name,
        sender    = charName,
        message   = message,
        timestamp = os.time(),
    }

    -- Broadcast to every player in the server
    TriggerClientEvent('qbx_multijob:client:BusinessAnnouncement', -1, payload)

    -- Log to server console
    print(('[qbx_multijob] [ANNOUNCE] %s (%s | %s @ %s): %s')
        :format(charName, citizenid, row.grade_name, row.job_label or row.job_name, message))

    -- Optional Discord webhook
    if Config.DiscordWebhook and Config.DiscordWebhook ~= '' then
        PerformHttpRequest(Config.DiscordWebhook, function() end, 'POST',
            json.encode({
                username = 'Business Announcements',
                embeds = {{
                    title       = ('📢 %s — %s'):format(payload.jobLabel, payload.gradeName),
                    description = message,
                    color       = 0xe8a045,
                    footer      = { text = charName .. ' • ' .. os.date('%Y-%m-%d %H:%M:%S') },
                }},
            }),
            { ['Content-Type'] = 'application/json' }
        )
    end

    return true, 'Announcement sent to all players.'
end)

-- Clean up cooldown entry when a player drops
AddEventHandler('playerDropped', function()
    cooldowns[source] = nil
end)

-- Expose remaining cooldown so the client UI can show a countdown
lib.callback.register('qbx_multijob:server:GetAnnounceCooldown', function(src)
    return getCooldownRemaining(src)
end)

-- Expose whether this player's active grade is allowed to announce
lib.callback.register('qbx_multijob:server:CanAnnounce', function(src)
    local player = Infin8Multijob.GetPlayer(src)
    if not player then return false, nil end
    local citizenid = Infin8Multijob.GetCitizenId(player)
    if not citizenid then return false, nil end

    local rows = MySQL.query.await(
        'SELECT `grade_name`, `job_label` FROM `player_multijobs` WHERE `citizenid` = ? AND `is_active` = 1 LIMIT 1',
        { citizenid }
    ) or {}
    local row = rows[1]
    if not row then return false, nil end
    return isAllowedGrade(row.grade_name), row
end)

print('^2[qbx_multijob]^7 Business announcements server loaded.')
