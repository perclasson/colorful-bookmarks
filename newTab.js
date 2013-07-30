var columnWidth = 222;

function paletteToGradient(colors) {
  // Transform to Color objects
  colors = _.map(colors, function(c) { return $.Color(c[0], c[1], c[2]) });
  colors = _.sortBy(colors, function(c) { return 1 - c.saturation() });

  if (colors.length > 1) {
    colors = _.reduce(colors, function(compare, color) {
      return [compare[0], _.max([compare[1], color], function (c) {
        return Math.abs(compare[0].hue() - c.hue())
      })];
    }, _.first(colors, 2));
  }
  else if (colors.length == 1) {
    colors[1] = colors[0];
  }

  var darker = colors[0].lightness(0.5).saturation(0.8);
  var lighter = colors[1].lightness(0.7);

  return 'linear-gradient(to top, ' + darker.toRgbaString() + ',' + lighter.toRgbaString() + ')';
}

function resizeContainer() {
  var bookmarksWidth = Math.floor($(window).width()*0.8);
  var bookmarksHeightMargin = columnWidth / 2;
  var $bookmarks = $('#bookmarks');
  $bookmarks.width(bookmarksWidth);
  $bookmarks.css({
    'left': (bookmarksWidth % columnWidth)/2,
    'top': bookmarksHeightMargin,
    'paddingBottom': bookmarksHeightMargin
  });
}

function appendBookmarks($bookmarks, nodes, rootIds) {
  return _.reduce(nodes, function($bookmarks, node) {
    if (node.url) {
      // Link
      var $bookmark = $('<a>', {'href': node.url, 'class': 'item'})
        .addClass(node.parentId)
        .append(node.title)
        .append($('<img>', {'src': 'chrome://favicon/' + node.url}));
      return $bookmarks.append($bookmark);
    }
    else if (node.children && node.children.length > 0) {
      // Folder
      var $folder = $('<a>', {'class': 'folder item'})
        .addClass(node.parentId)
        .append(node.title)
        .data('filter', '.' + node.id)
        .append($('<img>', {'src': 'folder.png'}));
      var $back = $('<a>', {'class': 'back item'})
        .addClass(node.id)
        .append('Back')
        .append($('<img>', {'src': 'back.png'}));
      $back.click(function(e) {
        e.preventDefault();

        window.history.back();
      });
      var $div = $('<div>').append($folder).append($back);
      return $bookmarks.append(appendBookmarks($div, node.children));
    }
    else {
      // Empty folder
      return $bookmarks;
    }
  }, $bookmarks);
}

function setItemGradient($item, palette) {
  $item.css({'background': paletteToGradient(palette)});
}

document.addEventListener('DOMContentLoaded', function () {
  resizeContainer();
  var $bookmarks = $('#bookmarks').hide();
  var colorThief = new ColorThief();
  var $items;
  var mostVisited = [];

  colorThief.worker.onmessage = function (event) {
    var $item = $($items[event.data.i]);
    var hostname = $item[0].hostname || 'folder';
    var palette = event.data.palette;
    var newStorageItem = {};
    newStorageItem[hostname] = {
      palette: palette
    };
    chrome.storage.local.set(newStorageItem);
    setItemGradient($item, palette);
  };

  chrome.bookmarks.getTree(function(nodes) {
    var bookmarksBar = nodes[0].children[0];
    var otherBookmarks = nodes[0].children[1];

    appendBookmarks(
      $bookmarks,
      bookmarksBar.children.concat(otherBookmarks.children),
      [bookmarksBar.id, otherBookmarks.id]
    );

    $bookmarks.imagesLoaded(function() {
      $items = $('.item', $bookmarks);
      $bookmarks.show();
      var filter = '.' + bookmarksBar.id + ', .' + otherBookmarks.id;
      $bookmarks.isotope({
        masonry: { columnWidth: columnWidth },
        itemSelector : '.item',
        filter: filter
      });

      _.each($items, function(item, i) {
        var $item = $(item);
        var img = $('img', $item)[0];
        if (typeof img != 'undefined' && img.src.slice(-8) != 'back.png') {
          var hostname = item.hostname || 'folder';
          chrome.storage.local.get(hostname, function (item) {
            var hostItem = item[hostname];
            if (hostItem && hostItem.palette) {
              setItemGradient($item, hostItem.palette);
            }
            else {
              colorThief.setPalette(i, img, 5);
            }
          });
        }
        if ($item.hasClass('folder')) {
          $item.click(function(e) {
            e.preventDefault();
            $bookmarks.isotope({filter: $item.data('filter')});
            history.pushState($item.data('filter'));
            return false;
          });
        }
      });
      window.addEventListener("popstate", function(e) {
        if (e.state) {
          $('#bookmarks').isotope({filter: e.state});
        }
        else {
          $('#bookmarks').isotope({filter: filter});
        }
      });
    });
  });

});

window.addEventListener("resize", function() {
  resizeContainer();
});