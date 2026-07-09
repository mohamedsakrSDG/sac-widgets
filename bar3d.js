(function () {

  // ---- Load amCharts 4 libraries once, then build the chart ----
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (document.querySelector('script[src="' + src + '"]')) {
        resolve();
        return;
      }
      var s = document.createElement('script');
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function loadAmCharts() {
    if (window.__amchartsLoadingPromise) {
      return window.__amchartsLoadingPromise;
    }
    window.__amchartsLoadingPromise = loadScript('https://cdn.amcharts.com/lib/4/core.js')
      .then(function () { return loadScript('https://cdn.amcharts.com/lib/4/charts.js'); })
      .then(function () { return loadScript('https://cdn.amcharts.com/lib/4/themes/animated.js'); });
    return window.__amchartsLoadingPromise;
  }

  class Bar3DWidget extends HTMLElement {

    constructor() {
      super();
      this._shadowRoot = this.attachShadow({ mode: 'open' });
      this._props = {
        width: 600,
        height: 400,
        chartTitle: '3D Bar Chart',
        depth: 30,
        rotationX: 15,
        rotationY: 20,
        barColor: '#2c6693'
      };
      this._chart = null;
      this._rows = []; // [{ category: 'Dept A', value: 120 }, ...]

      var container = document.createElement('div');
      container.setAttribute('id', 'chartdiv-container');
      container.style.width = '100%';
      container.style.height = '100%';
      this._shadowRoot.appendChild(container);
      this._container = container;
    }

    // ---------- SAC lifecycle hooks ----------

    onCustomWidgetBeforeUpdate(changedProperties) {
      Object.assign(this._props, changedProperties);
    }

    onCustomWidgetAfterUpdate(changedProperties) {
      this._render();
    }

    onCustomWidgetResize(width, height) {
      this._props.width = width;
      this._props.height = height;
      if (this._chart) {
        this._chart.invalidateSize();
      }
    }

    onCustomWidgetDestroy() {
      if (this._chart) {
        this._chart.dispose();
        this._chart = null;
      }
    }

    // ---------- Data binding entry point ----------
    // SAC calls this (or sets the dataBinding property directly) whenever
    // the bound query result changes. We normalize whatever shape SAC gives us
    // into a simple [{category, value}] array and re-render.

    set dataBinding(binding) {
      this._dataBinding = binding;
      if (!binding || binding.state !== 'success') {
        return;
      }
      var data = binding.data || [];
      var dims = binding.metadata && binding.metadata.dimensions ? binding.metadata.dimensions : [];
      var meas = binding.metadata && binding.metadata.mainStructureMembers ? binding.metadata.mainStructureMembers : [];

      var dimKey = dims.length ? dims[0].id : null;
      var measKey = meas.length ? meas[0].id : null;

      this._rows = data.map(function (row) {
        return {
          category: dimKey ? row[dimKey].label : '',
          value: measKey ? row[measKey].raw : 0
        };
      });

      this._render();
    }

    get dataBinding() {
      return this._dataBinding;
    }

    setDataSource(data) {
      // Manual fallback: accepts [{category, value}, ...] directly from a script
      this._rows = data || [];
      this._render();
    }

    // ---------- Render ----------

    _render() {
      var self = this;
      loadAmCharts().then(function () {
        self._draw();
      });
    }

    _draw() {
      var self = this;
      var am4core = window.am4core;
      var am4charts = window.am4charts;
      var am4themes_animated = window.am4themes_animated;

      if (!am4core || !am4charts) {
        return;
      }

      am4core.useTheme(am4themes_animated);

      if (this._chart) {
        this._chart.dispose();
      }

      var chart = am4core.create(this._container, am4charts.XYChart3D);
      chart.depth = this._props.depth;
      chart.angle = this._props.rotationY;

      if (chart.hiddenState) {
        chart.hiddenState.properties.opacity = 0;
      }

      chart.data = this._rows.length ? this._rows : [
        { category: 'No data', value: 0 }
      ];

      var categoryAxis = chart.xAxes.push(new am4charts.CategoryAxis3D());
      categoryAxis.dataFields.category = 'category';
      categoryAxis.renderer.grid.template.location = 0;
      categoryAxis.renderer.minGridDistance = 40;
      categoryAxis.title.text = '';

      var valueAxis = chart.yAxes.push(new am4charts.ValueAxis3D());
      valueAxis.title.text = '';

      var series = chart.series.push(new am4charts.ColumnSeries3D());
      series.dataFields.valueY = 'value';
      series.dataFields.categoryX = 'category';
      series.name = this._props.chartTitle;
      series.columns.template.fill = am4core.color(this._props.barColor);
      series.columns.template.stroke = am4core.color(this._props.barColor);
      series.columns.template.tooltipText = '{categoryX}: [bold]{valueY}[/]';
      series.columns.template.events.on('hit', function (ev) {
        var category = ev.target.dataItem.categories.categoryX;
        var value = ev.target.dataItem.values.valueY.value;
        var evt = new CustomEvent('onSelect', {
          detail: { category: category, value: value }
        });
        self.dispatchEvent(evt);
      });

      chart.legend = new am4charts.Legend();

      this._chart = chart;
    }
  }

  customElements.define('com-aqh-bar3d', Bar3DWidget);

})();
