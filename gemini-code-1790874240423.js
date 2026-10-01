async function dispatchLiveWhatsAppNotification(toPhone, staffName, messageType, customText) {
  try {
    const response = await fetch('http://localhost:5000/api/whatsapp/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ toPhone, staffName, messageType, customText })
    });
    const data = await response.json();
    if (data.success) {
      alert(`WhatsApp alert successfully sent to ${staffName} (${toPhone}) via Cloud Gateway!`);
    } else {
      throw new Error(data.error);
    }
  } catch (err) {
    console.warn('Backend WhatsApp Gateway unavailable, redirecting to Web WhatsApp:', err);
    window.open(`https://wa.me/${toPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(customText)}`, '_blank');
  }
}