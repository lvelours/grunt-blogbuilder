/*
 * blogbuilder
 * 
 *
 * Copyright (c) 2014 Matthew Daly
 * Licensed under the MIT license.
 */

'use strict';

module.exports = function (grunt) {

  // Please see the Grunt documentation for more information regarding task
  // creation: http://gruntjs.com/creating-tasks

  grunt.registerMultiTask('blogbuilder', 'Grunt plugin for building a blog.', function () {

    // Declare variables
    var _ = require('lodash'), moment = require('moment'), recent_posts, categories, category, langs, hljs, content, RSS, feed, newObj, post, post_items = [], chunk, postChunks = [], md, mdcontent, meta, data, options, output, path, Handlebars, MarkedMetadata, posts, pages, postTemplate, pageTemplate, indexTemplate, archiveTemplate, notFoundTemplate, permalink;

    // Merge task-specific and/or target-specific options with these defaults.
    options = this.options({
      punctuation: '.',
      separator: ', ',
      size: 5,
      year: new Date().getFullYear()
    });

    // Get Handlebars
    Handlebars = require('handlebars');

    // Create a helper for formatting categories for links
    Handlebars.registerHelper('linkformat', function (item, options) {
        return item.toLowerCase().replace(/\./g, '-');
    });

    // Get RSS
    RSS = require('rss');

    // Get Highlight.js
    hljs = require('highlight.js');

    // Get languages
    langs = hljs.listLanguages();

    // Register partials
    Handlebars.registerPartial({
        header: grunt.file.read(options.template.header),
        footer: grunt.file.read(options.template.footer),
        sidebar: grunt.file.read(options.template.sidebar)
    });

    // Get Marked Metadata
    MarkedMetadata = require('meta-marked');
    MarkedMetadata.setOptions({
        gfm: true,
        tables: true,
        smartLists: true,
        smartypants: true,
        langPrefix: 'hljs lang-',
        highlight: function (code, lang) {
            if (typeof lang !== "undefined" && langs.indexOf(lang) > 0) {
                return hljs.highlight(lang, code).value;
            } else {
                return hljs.highlightAuto(code).value;
            }
        }
    });

    // Get matching files
    posts = grunt.file.expand(options.src.posts + '*.md', options.src.posts + '*.markdown');
    pages = grunt.file.expand(options.src.pages + '*.md', options.src.pages + '*.markdown');

    // Get Handlebars templates
    postTemplate = Handlebars.compile(grunt.file.read(options.template.post));
    pageTemplate = Handlebars.compile(grunt.file.read(options.template.page));
    indexTemplate = Handlebars.compile(grunt.file.read(options.template.index));
    archiveTemplate = Handlebars.compile(grunt.file.read(options.template.archive));
    notFoundTemplate = Handlebars.compile(grunt.file.read(options.template.notfound));

    // Generate posts
    posts.forEach(function (file) {
        // Convert it to Markdown
        content = grunt.file.read(file);
        md = new MarkedMetadata(content);
        mdcontent = md.html;
        meta = md.meta;

        // Get path
        permalink = '/blog/' + (file.replace(options.src.posts, '').replace(/(\d{4})-(\d{2})-(\d{2})-/, '$1/$2/$3/').replace('.markdown', '').replace('.md', ''));
        path = options.www.dest + permalink;

        // Render the Handlebars template with the content
        data = {
            data: options.data,
            path: permalink + '/',
            meta: {
                title: meta.title.replace(/"/g, ''),
                date: meta.date,
                formattedDate: moment(new Date(meta.date)).format('Do MMMM YYYY h:mm:ss a'),
                categories: meta.categories
            },
            post: {
                content: mdcontent
            },
            year: options.year
        };
        post_items.push(data);
    });

    // Sort posts
    post_items = _.sortBy(post_items, function (item) {
        return item.meta.date;
    });

    // Get recent posts
    recent_posts = post_items.slice(Math.max(post_items.length - 5, 1)).reverse();

    // Output them
    post_items.forEach(function (data, index, list) {
        // Get next and previous
        if (index < (list.length - 1)) {
            data.next = {
                title: list[index + 1].meta.title,
                path: list[index + 1].path
            };
        }
        if (index > 0) {
            data.prev = {
                title: list[index - 1].meta.title,
                path: list[index - 1].path
            };
        }

        // Get recent posts
        data.recent_posts = recent_posts;

        // Render template
        output = postTemplate(data);

        // Write post to destination
        grunt.file.mkdir(options.www.dest + data.path);
        grunt.file.write(options.www.dest + data.path + '/index.html', output);
    });

    // Generate pages
    pages.forEach(function (file) {
        // Convert it to Markdown
        content = grunt.file.read(file);
        md = new MarkedMetadata(content);
        mdcontent = md.html;
        meta = md.meta;
        path = options.www.dest + '/' + (file.replace(options.src.pages, '').replace('.markdown', '').replace('.md', ''));

        // Render the Handlebars template with the content
        data = {
            data: options.data,
            path: path,
            meta: {
                title: meta.title.replace(/"/g, ''),
                date: meta.date
            },
            post: {
                content: mdcontent
            },
            recent_posts: recent_posts
        };
        output = pageTemplate(data);

        // Write page to destination
        grunt.file.mkdir(path);
        grunt.file.write(path + '/index.html', output);
    });

    // Generate archive
    data = {
        data: options.data,
        posts: [],
        recent_posts: recent_posts
    };

    // Get the posts
    post_items = post_items.reverse();
    for (post in post_items) {
        // Push it to the array
        data.posts.push(post_items[post]);
    }
    output = archiveTemplate(data);

    // Write the content to the file
    path = options.www.dest + '/blog/archives/';
    grunt.file.mkdir(path);
    grunt.file.write(path + '/index.html', output);

    // Generate RSS feed
    feed = new RSS({
        title: options.data.title,
        description: options.data.description,
        url: options.data.url
    });

    // Get the posts
    for (post in post_items.slice(0, 20)) {
        // Add to feed
        feed.item({
            title: post_items[post].meta.title,
            description: post_items[post].post.content,
            url: options.data.url + post_items[post].path,
            date: post_items[post].meta.date
        });
    }

    // Write the content to the file
    path = options.www.dest + '/atom.xml';
    grunt.file.write(path, feed.xml({indent: true}));

    // Create categories
    categories = {};
    _.each(post_items, function (element, index, list) {
        // Loop through each category
        for (var category in element.meta.categories) {
            // Push the object to that category's list
            if (!categories[element.meta.categories[category]]) {
                categories[element.meta.categories[category]] = [];
            }
            categories[element.meta.categories[category]].push(element);
        }
    });

    // Generate pages for categories
    _.each(categories, function (element, index, list) {
        // Loop through the categories and write them to the template
        var category_posts = [];
        for (var category_post in element) {
            category_posts.push(element[category_post]);
        }
        var data = {
            data: options.data,
            posts: category_posts,
            recent_posts: recent_posts
        };
        output = archiveTemplate(data);

        // Write the content to the file
        path = options.www.dest + '/blog/categories/' + index.toLowerCase().replace(/\./g, '-') + '/';
        grunt.file.mkdir(path);
        grunt.file.write(path + '/index.html', output);
    });

    // Generate RSS feeds for categories
    _.each(categories, function (element, index, list) {
        // Loop through the categories and write them to the template
        var category_posts = [];
        for (var category_post in element) {
            category_posts.push(element[category_post]);
        }

        // Create the feed
        feed = new RSS({
            title: index + ' | ' + options.data.title,
            description: index + ' | ' + options.data.description,
            url: options.data.url + '/blog/categories/' + index.toLowerCase().replace(/\./g, '-') + '/'
        });

        // Get the posts
        for (var post in category_posts) {
            // Add to feed
            feed.item({
                title: category_posts[post].meta.title,
                description: category_posts[post].post.content,
                url: options.data.url + category_posts[post].path,
                date: category_posts[post].meta.date
            });
        }

        // Write feed
        path = options.www.dest + '/blog/categories/' + index.toLowerCase().replace(/\./g, '-') + '/atom.xml';
        grunt.file.write(path, feed.xml({indent: true}));
    });

    // Generate index
    // First, break it into chunks
    while (post_items.length > 0) {
        postChunks.push(post_items.splice(0, options.size));
    }

    // Then, loop through each chunk and write the content to the file
    for (chunk in postChunks) {
        data = {
            data: options.data,
            posts: []
        };

        // Get the posts
        for (post in postChunks[chunk]) {
            data.posts.push(postChunks[chunk][post]);
        }

        // Generate content
        if (Number(chunk) + 1 < postChunks.length) {
          data.nextChunk = Number(chunk) + 2;
        }
        if (Number(chunk) + 1 > 1) {
          data.prevChunk = Number(chunk);
        }
        data.recent_posts = recent_posts;
        output = indexTemplate(data);

        // If this is the first page, also write it as the index
        if (chunk === "0") {
            grunt.file.write(options.www.dest + '/index.html', output);
        }

        // Write the content to the file
        path = options.www.dest + '/posts/' + (Number(chunk) + 1);
        grunt.file.mkdir(path);
        grunt.file.write(path + '/index.html', output);
    }

    // Create 404 page
    newObj = {
        data: options.data
    };

    output = notFoundTemplate(newObj);
    path = options.www.dest;
    grunt.file.mkdir(path);
    grunt.file.write(path + '/404.html', output);

    // Create robots.txt file
    grunt.file.copy(options.template.robots, options.www.dest + '/robots.txt');

    // Iterate over all specified file groups.
    this.files.forEach(function (file) {
      // Concat specified files.
      var src = file.src.filter(function (filepath) {
        // Warn on and remove invalid source files (if nonull was set).
        if (!grunt.file.exists(filepath)) {
          grunt.log.warn('Source file "' + filepath + '" not found.');
          return false;
        } else {
          return true;
        }
      }).map(function (filepath) {
        // Read file source.
        return grunt.file.read(filepath);
      }).join(grunt.util.normalizelf(options.separator));

      // Handle options.
      src += options.punctuation;

      // Write the destination file.
      grunt.file.write(file.dest, src);

      // Print a success message.
      grunt.log.writeln('File "' + file.dest + '" created.');
    });
  });

};
