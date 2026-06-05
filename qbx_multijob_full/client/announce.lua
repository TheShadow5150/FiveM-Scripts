-- ╔══════════════════════════════════════════════════════════════╗
-- ║     qbx_multijob — Business Announcements (Client)          ║
-- ╚══════════════════════════════════════════════════════════════╝

-- Forward incoming announcement to the NUI so it can render the toast overlay.
RegisterNetEvent('qbx_multijob:client:BusinessAnnouncement', function(payload)
    if not payload or type(payload) ~= 'table' then return end
    SendNUIMessage({ action = 'businessAnnouncement', announcement = payload })
end)
