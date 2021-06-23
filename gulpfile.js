'use strict';

let gulp = require('gulp');
let del = require('del');
let path = require('path');
let using = require('gulp-using');
let sass = require('gulp-sass');

const DIST = "dist";
const SRC = "src";

/*
 * Purge all built content.
 */
gulp.task('purge', function() {
	return del(path.join(DIST, "*"));
});

/*
 * Build and deploy all templates.
 */
gulp.task('build-templates', function() {
	return gulp.src(path.join(SRC, 'templates/**/{*.hbs,.htaccess}'), { base: path.join(SRC, 'templates') })
	.pipe(using())
	.pipe(gulp.dest(path.join(DIST, 'templates')));
});

/*
 * Build and deploy all stylesheets.
 */
gulp.task('build-stylesheets', function() {
	return gulp.src(path.join(SRC, 'stylesheets/**/*.scss'), { base: path.join(SRC, 'stylesheets') })
	.pipe(using())
	.pipe(sass())
	.pipe(gulp.dest(path.join(DIST, 'stylesheets')));
});

/*
 * Build and deploy all tables.
 */
gulp.task('build-tables', function() {
	return gulp.src(path.join(SRC, 'tables/**/{*.json,.htaccess}'), { base: path.join(SRC, 'tables') })
	.pipe(using())
	.pipe(gulp.dest(path.join(DIST, 'tables')));
});

/*
 * Build and deploy all pages.
 */
gulp.task('build-pages', function() {
	return gulp.src(path.join(SRC, 'pages/**/{*.html,.htaccess}'), { base: path.join(SRC, 'pages') })
	.pipe(using())
	.pipe(gulp.dest(path.join(DIST)));
});

/*
 * Build and deploy all scripts.
 */
gulp.task('build-scripts', function() {
	return gulp.src(path.join(SRC, 'scripts/**/*.js'), { base: path.join(SRC, 'scripts') })
	.pipe(using())
	.pipe(gulp.dest(path.join(DIST, 'scripts')));
});

/*
 * Watch folders for any changes.
 */
gulp.task('watch', function() {
	gulp.watch(SRC + '/templates/**/{*.hbs,.htaccess}', gulp.series(['build-templates']));
	gulp.watch(SRC + '/stylesheets/**/*.scss', gulp.series(['build-stylesheets']));
	gulp.watch(SRC + '/tables/**/{*.json,.htaccess}', gulp.series(['build-tables']));
	gulp.watch(SRC + '/pages/**/{*.html,.htaccess}', gulp.series(['build-pages']));
	gulp.watch(SRC + '/scripts/**/*.js', gulp.series(['build-scripts']));
});

/*
 * Build project.
 */
gulp.task('build', gulp.series('purge', 'build-templates', 'build-stylesheets', 'build-tables', 'build-pages', 'build-scripts'));
gulp.task('build-and-watch', gulp.series('build', 'watch'));
