-- NUI → server callback bridge for announcement endpoints.
-- Registered here so sv_announce.lua stays clean.

RegisterNUICallback('canAnnounce', function(_, cb)
    local ok, row = lib.callback.await('qbx_multijob:server:CanAnnounce', false)
    cb({ ok = ok == true, row = row })
end)

RegisterNUICallback('getAnnounceCooldown', function(_, cb)
    local remaining = lib.callback.await('qbx_multijob:server:GetAnnounceCooldown', false)
    cb({ remaining = remaining or 0 })
end)

RegisterNUICallback('sendAnnouncement', function(data, cb)
    local ok, msg = lib.callback.await('qbx_multijob:server:SendAnnouncement', false, data and data.message or '')
    cb({ ok = ok == true, msg = msg })
end)
