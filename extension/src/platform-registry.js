const platforms = [window.leboncoin];

function getCurrentPlatform(url = window.location.href) {
  for (const platform of platforms) {
    if (platform && platform.isSupported(url)) return platform;
  }
  return null;
}

window.getCurrentPlatform = getCurrentPlatform;
