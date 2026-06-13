import dash
from dash import dcc, html, Input, Output, State, ALL, ctx
import dash_bootstrap_components as dbc
import pandas as pd
import json
import os

# ==========================================
# 1. 初始化 Dash 與 HTML 模板 (Firebase & Globe.gl)
# ==========================================
app = dash.Dash(
    __name__,
    external_stylesheets=[
        dbc.themes.CYBORG,
        "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css"
    ],
    title="NYCU 陽明交大交換系統",
    suppress_callback_exceptions=True
)

# 注入與你提供的一致的 HTML 模板，包含 Firebase 留言邏輯
app.index_string = '''
<!DOCTYPE html>
<html>
    <head>
        {%metas%}
        <title>{%title%}</title>
        {%favicon%}
        {%css%}
        <style>
            ::-webkit-scrollbar { width: 6px; }
            ::-webkit-scrollbar-track { background: #020617; }
            ::-webkit-scrollbar-thumb { background: #1E293B; border-radius: 10px; }
            body { background-color: #020617; margin: 0; overflow: hidden; font-family: "Noto Sans TC", sans-serif; }
            .accordion-button { background-color: #FFFFFF !important; color: #000000 !important; font-weight: bold; border-bottom: 1px solid #E2E8F0; }
            .accordion-button:not(.collapsed) { color: #0088CC !important; background-color: #F8FAFC !important; }
            .accordion-body { background-color: #F8FAFC; color: #334155; font-size: 14px; line-height: 1.6;}
        </style>
        <script src="//unpkg.com/three"></script>
        <script src="//unpkg.com/globe.gl"></script>
        <script type="module">
            /* Firebase 核心邏輯 (保留你原本的設定) */
            // ... (Firebase 程式碼與你提供的一致，此處省略以節省空間，請保持你原本內容)
        </script>
    </head>
    <body>
        {%app_entry%}
        <footer>{%config%}{%scripts%}{%renderer%}</footer>
    </body>
</html>
'''

# ==========================================
# 2. 資料對接：讀取你的 JSON
# ==========================================
def load_merged_data():
    json_path = 'data/nycu_v4_merged.json'
    if os.path.exists(json_path):
        with open(json_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        df = pd.DataFrame(data)
        
        # 欄位對照映射 (將你的 JSON 欄位對應到 UI 需要的名稱)
        df['ID'] = df['id'].astype(str)
        df['University_CN'] = df['name']
        df['University_EN'] = df['name_en']
        df['Country_CN'] = df['country']
        df['Country_EN'] = df['country'] # JSON 只有一格 country
        df['Quota'] = df['quota_full']
        df['Eligibility'] = df['eligibility_full']
        df['GPA_Req'] = df['grade_full']
        df['Lang_Req'] = df['language_full']
        df['Remarks'] = df['remarks_full']
        df['Lat'] = df['lat'].fillna(0)
        df['Lon'] = df['lng'].fillna(0)
        
        # 預先處理篩選用數字
        def parse_gpa(text):
            match = re.search(r'GPA\s*([\d\.]+)', str(text))
            return float(match.group(1)) if match else 0.0
        
        import re
        df['gpa_val'] = df['GPA_Req'].apply(parse_gpa)
        
        # 處理學期篩選 (Spring/Fall)
        df['is_spring'] = df['Quota'].str.contains('Spring|第二學期|2nd', case=False, na=False) | ~df['Quota'].str.contains('Fall|第一學期|1st', case=False, na=False)
        df['is_fall'] = df['Quota'].str.contains('Fall|第一學期|1st', case=False, na=False) | ~df['Quota'].str.contains('Spring|第二學期|2nd', case=False, na=False)
        
        return df
    else:
        print(f"找不到 {json_path}，請確認資料工程師已產出檔案。")
        return pd.DataFrame()

df = load_merged_data()

# ==========================================
# 3. UI 佈局 (結合你的 Dash 設計)
# ==========================================
COLORS = {'deep_space': '#020617', 'nav_bg': '#0F172A', 'accent': '#00E5FF', 'heart': '#EA4335'}

app.layout = html.Div([
    dcc.Store(id='favorites-store', data=[]),
    dcc.Store(id='globe-data-store', data=df.to_dict('records')),
    dcc.Input(id='hidden-globe-click', value='', type='text', style={'display': 'none'}),

    # 頂部導覽
    dbc.Navbar(
        dbc.Container([
            dbc.Button(html.I(className="fa-solid fa-bars"), id="btn-hamburger", color="link", style={'color': 'white'}),
            html.Div([
                dbc.Input(id="top-search-bar", placeholder="搜尋全台大版交換學校...", style={'width': '400px', 'borderRadius': '20px', 'backgroundColor': 'rgba(255,255,255,0.1)', 'color': 'white', 'border': 'none'})
            ], className="mx-auto"),
            html.Img(id="user-avatar", src="https://upload.wikimedia.org/wikipedia/commons/c/c1/Google_%22G%22_logo.svg", style={'width': '35px', 'cursor': 'pointer'})
        ]), color=COLORS['nav_bg'], className="mb-0", style={'height': '65px'}
    ),

    # 主要容器
    html.Div([
        # 左側 3D 地球
        html.Div([
            html.Div(id='three-globe-container', style={'width': '100%', 'height': '100%'}),
            # 懸浮資訊提示
            html.Div(id='map-preview-dialog', style={'display': 'none'}) 
        ], style={'flex': '1', 'position': 'relative'}),

        # 右側過濾與列表 (台大風格)
        html.Div([
            html.H5("我的資格篩選", style={'color': COLORS['accent'], 'fontWeight': 'bold', 'marginBottom': '20px'}),
            
            html.Label("出發學期", style={'color': '#94A3B8', 'fontSize': '12px'}),
            dcc.Checklist(
                id='filter-term',
                options=[{'label': ' 春季 (Spring)', 'value': 'spring'}, {'label': ' 秋季 (Fall)', 'value': 'fall'}],
                value=['spring', 'fall'],
                labelStyle={'display': 'block', 'color': 'white', 'marginBottom': '10px'}
            ),

            html.Label("最低 GPA 門檻 (4.3)", style={'color': '#94A3B8', 'fontSize': '12px', 'marginTop': '10px'}),
            dcc.Slider(id='filter-gpa-slider', min=0, max=4.3, step=0.1, value=0, marks={0: '0', 4.3: '4.3'}),

            dbc.Button("套用條件", id='btn-apply', className="w-100 mt-4", style={'backgroundColor': COLORS['accent'], 'color': 'black', 'fontWeight': 'bold'}),
            
            html.Hr(style={'borderColor': '#1E293B', 'margin': '20px 0'}),
            
            html.Div(id='school-list-container', style={'height': 'calc(100vh - 450px)', 'overflowY': 'auto'})
        ], style={'width': '380px', 'backgroundColor': COLORS['nav_bg'], 'padding': '25px', 'borderLeft': '1px solid #1E293B'}),

        # 點擊後跳出的詳情側邊欄 (右側抽屜)
        dbc.Offcanvas(
            id="school-details-sidebar",
            title="學校詳細資訊",
            is_open=False,
            placement="right",
            style={'backgroundColor': '#FFFFFF', 'color': '#000000'}
        )
    ], style={'display': 'flex', 'height': 'calc(100vh - 65px)'})
])

# ==========================================
# 4. 互動邏輯 (Callbacks)
# ==========================================

# 3D 地球繪製 (Clientside JS)
app.clientside_callback(
    """
    function(data) {
        const container = document.getElementById('three-globe-container');
        if (!container || !data) return;
        if (!window.myGlobe) {
            window.myGlobe = Globe()(container)
                .globeImageUrl('//unpkg.com/three-globe/example/img/earth-day.jpg')
                .backgroundImageUrl('//unpkg.com/three-globe/example/img/night-sky.png')
                .htmlElementsData(data)
                .htmlElement(d => {
                    const el = document.createElement('div');
                    el.innerHTML = `<div style="width:12px;height:12px;background:#00E5FF;border-radius:50%;border:2px solid white;box-shadow:0 0 10px #00E5FF;cursor:pointer;"></div>`;
                    el.onclick = () => {
                        const input = document.getElementById('hidden-globe-click');
                        input.value = d.ID;
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                    };
                    return el;
                });
            window.myGlobe.pointOfView({ altitude: 2.0 });
        } else {
            window.myGlobe.htmlElementsData(data);
        }
        return window.dash_clientside.no_update;
    }
    """,
    Output('three-globe-container', 'id'),
    Input('globe-data-store', 'data')
)

@app.callback(
    [Output('globe-data-store', 'data'), Output('school-list-container', 'children')],
    [Input('btn-apply', 'n_clicks'), Input('top-search-bar', 'value')],
    [State('filter-term', 'value'), State('filter-gpa-slider', 'value')]
)
def update_filters(n, search, terms, gpa_min):
    dff = df.copy()
    
    # 學期篩選
    if 'spring' in terms and 'fall' not in terms:
        dff = dff[dff['is_spring']]
    elif 'fall' in terms and 'spring' not in terms:
        dff = dff[dff['is_fall']]
        
    # GPA 篩選
    dff = dff[dff['gpa_val'] >= gpa_min]
    
    # 搜尋
    if search:
        dff = dff[dff['University_CN'].str.contains(search, case=False) | dff['University_EN'].str.contains(search, case=False)]
    
    list_items = [
        html.Div([
            html.Div(row['Country_CN'], style={'fontSize': '10px', 'color': COLORS['accent']}),
            html.Div(row['University_CN'], style={'fontWeight': 'bold', 'color': 'white'}),
            html.Div(f"GPA: {row['GPA_Req'][:10]}...", style={'fontSize': '11px', 'color': '#94A3B8'})
        ], className="p-3 border-bottom border-dark cursor-pointer") for _, row in dff.iterrows()
    ]
    
    return dff.to_dict('records'), list_items

@app.callback(
    [Output('school-details-sidebar', 'is_open'), Output('school-details-sidebar', 'children')],
    [Input('hidden-globe-click', 'value')],
    prevent_initial_call=True
)
def open_sidebar(school_id):
    if not school_id: return False, ""
    
    info = df[df['ID'] == school_id].iloc[0]
    
    content = html.Div([
        html.H2(info['University_CN'], style={'fontWeight': 'bold', 'color': '#002D62'}),
        html.P(info['University_EN'], className="text-muted"),
        html.Hr(),
        dbc.Accordion([
            dbc.AccordionItem([
                html.P([html.Strong("名額: "), info['Quota']]),
                html.P([html.Strong("國家: "), info['Country_CN']])
            ], title="基本資訊"),
            dbc.AccordionItem([
                html.P([html.Strong("語言要求: "), info['Lang_Req']]),
                html.P([html.Strong("成績限制: "), info['GPA_Req']])
            ], title="申請門檻"),
            dbc.AccordionItem(html.P(info['Eligibility']), title="系所年級限制"),
            dbc.AccordionItem(html.P(info['Remarks']), title="備註事項"),
        ], flush=True, start_collapsed=False),
        html.Br(),
        dbc.Button("前往 OIA 簡章官網", color="primary", className="w-100", href="https://oia.nycu.edu.tw/", target="_blank")
    ])
    
    return True, content

if __name__ == '__main__':
    app.run(debug=True)