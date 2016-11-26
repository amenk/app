'use strict';

const path = require('path');
const gulp = require('gulp');
const del = require('del');
const runSequence = require('run-sequence');
const PolymerProject = require('polymer-build').PolymerProject;
const mergeStream = require('merge-stream');
const browserSync = require('browser-sync').create();
const historyApiFallback = require('connect-history-api-fallback');
const $ = require('gulp-load-plugins')();
const cordova = require("cordova-lib").cordova;

const distDir = 'build';
const appDir = 'www';

let watches = [{
    src: "elements/**/*",
    tasks: browserSync.reload
}];

gulp.task('clean', function() {
    return del([distDir, appDir]);
});

function buildPolymer(project) {
    const sources = project.sources()
        .pipe($.if(['index.html', 'app.html'], $.useref()))
        .pipe(project.splitHtml())
        .pipe($.if(/elements[\\\/].+\.js/, $.babel()))
        .pipe(project.rejoinHtml());

    /*
     * Inline CSS minifications don't work at the moment because polymer-build
     * doesn't split out CSS at the moment. This is a bug however, and will be
     * fixed in one of the next versions.
     */

    return mergeStream(sources, project.dependencies())
        .pipe(project.analyzer)
        .pipe(project.bundler)
        .pipe(project.splitHtml())
        .pipe($.if(/\.css$/, $.cleanCss({ keepSpecialComments: 0 })))
        .pipe($.if(/\.js$/, $.uglify({ comments: false })))
        .pipe(project.rejoinHtml());
}

gulp.task('polymer', function () {
    const project = new PolymerProject(require('./polymer.json'));
    return buildPolymer(project)
        .pipe(gulp.dest(distDir));
});

gulp.task('polymer-cordova', function() {
    const projectCordova = new PolymerProject(require('./polymer-cordova.json'));
    return buildPolymer(projectCordova)
        .pipe($.if('elements/app-shell.html', $.crisper()))
        .pipe(gulp.dest(appDir))
});

gulp.task('generate-icons-ios', function() {
    return gulp.src('images/icon-full.png')
        .pipe($.responsive({
            '*.png': [29, 40, 50, 57, 58, 60, 72, 76, 80, 100, 114, 120, 144, 152, 180].map(function (width) {
                return {width: width, rename: {suffix: '-' + width}};
            })
        }))
        .pipe(gulp.dest(path.join(appDir, 'images/manifest')));
});

gulp.task('generate-icons', ['generate-icons-ios'], function () {
    return gulp.src('images/icon.png')
        .pipe($.responsive({
            '*.png': [48, 72, 96, 144, 192, 512].map(function (width) {
                return {width: width, rename: {suffix: '-' + width + 'x' + width}};
            })
        }))
        .pipe(gulp.dest(path.join(distDir, 'images/manifest')));
});

gulp.task('serve', function () {
    browserSync.init({
        notify: false,
        open: false,
        reloadOnRestart: true,
        snippetOptions: {
            rule: {
                match: '<span id="browser-sync-binding"></span>'
            }
        },
        middleware: [historyApiFallback()],
        ui: false,
        injectChanges: false,
        ghostMode: false,
        server: {
            baseDir: ['.']
        }
    });

    watches.forEach(function (item) {
        gulp.watch(item.src, item.tasks);
    });
});


gulp.task("package-cordova", [''], function (callback) {
    cordova.build({
        "platforms": ["ios"],
        "options": {
            argv: []
        }
    }, callback);
});

gulp.task('build', function(cb) {
    runSequence(
        'clean',
        ['polymer', 'generate-icons'],
        cb
    );
});

gulp.task('build-cordova', function(cb) {
    runSequence(
        'clean',
        'polymer-cordova', 'generate-icons',
        cb
    );
});
