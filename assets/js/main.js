const startTime = Date.now();
const minLoading = 3000; // at least 3s
let progress = 0;
let progressTimer;
const imagesLoadedKey = "_imagesLoadedKey";
// update progress UI
function updateProgress(value) {
    $('#loading-progress').text(value + '%'); // <-- put <div id="loading-progress"></div> inside #app-loading
}

// start fake counter
function startFakeProgress() {
    progressTimer = setInterval(() => {
        if (progress < 95) {  // stop auto-increment at 95%
            progress += 5;
            updateProgress(progress);
        }
    }, minLoading / 20); // 20 steps (5% each) in 3s
}

startFakeProgress();

$(function () {
    const startTime = Date.now();
    $('#app-bg').imagesLoaded({ background: true })
        .always(function (instance) {
            console.log('all images loaded');
        })
        .done(function (instance) {

            var minLoading = 100;
            if (!sessionStorage.getItem(imagesLoadedKey)) {
                sessionStorage.setItem(imagesLoadedKey, "loaded");
                minLoading = 3000; // minimum 3s
            }

            const elapsed = Date.now() - startTime;

            const remaining = Math.max(0, minLoading - elapsed);

            setTimeout(() => {
                clearInterval(progressTimer); // stop fake counter
                updateProgress(100); // force 100%

                $('#app-loading>div').fadeOut(undefined, () => {
                    $('#app-loading').addClass('animate__fadeOutUp')
                        .one('animationend', function () {
                            $(this).remove();
                        });
                    $('.animate__paused')
                        .css('visibility', 'visible')
                        .removeClass('animate__paused');
                    $('#app-wrapper').removeClass('loading');
                });
            }, remaining);

        })
        .fail(function () {
            console.log('all images loaded, at least one is broken');
        })
        .progress(function (instance, image) {
            var result = image.isLoaded ? 'loaded' : 'broken';
            console.log('image is ' + result + ' for ' + image.img.currentSrc);
            //          console.log("imagesLoaded saw:", image.img.src);
            // console.log("browser actually loaded:", image.img.currentSrc);
        });
})

$('#app-nav-sm-menu-toggler').on('click', function () {
    $('#app-nav-sm-full').addClass('open');
});
$('#app-nav-sm-full-toggler').on('click', function () {
    $('#app-nav-sm-full').removeClass('open');
});
