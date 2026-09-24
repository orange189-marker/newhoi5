// Flag images for DOM and canvas. Nations without a known flag get a
// generated banner in their map colour.
window.IM = window.IM || {};

(function () {
  const urlCache = new Map(), imgCache = new Map();

  function generated(c) {
    const key = 'gen:' + c.tag + c.color;
    if (urlCache.has(key)) return urlCache.get(key);
    const cv = document.createElement('canvas'); cv.width = 96; cv.height = 64;
    const x = cv.getContext('2d');
    x.fillStyle = c.color; x.fillRect(0, 0, 96, 64);
    x.fillStyle = 'rgba(255,255,255,0.85)'; x.fillRect(0, 26, 96, 12);
    x.fillStyle = 'rgba(0,0,0,0.25)'; x.fillRect(0, 44, 96, 20);
    const url = cv.toDataURL();
    urlCache.set(key, url);
    return url;
  }

  IM.flagURL = function (c) {
    if (!c) return '';
    return (IM.FLAGS && (IM.FLAGS[c.flag] || IM.FLAGS[c.tag])) || generated(c);
  };

  // Returns a loaded (or loading) Image for canvas drawing.
  IM.flagImage = function (c) {
    const url = IM.flagURL(c);
    let img = imgCache.get(url);
    if (!img) {
      img = new Image();
      img.onload = () => { if (IM.Render) IM.Render.dirty = true; };
      img.src = url;
      imgCache.set(url, img);
    }
    return img;
  };
})();
