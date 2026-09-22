package com.shadowtasks;

import android.app.Activity;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import android.widget.Button;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class MainActivity extends Activity {
    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final Handler main = new Handler(Looper.getMainLooper());
    private EditText endpoint;
    private EditText title;
    private TextView status;
    private LinearLayout list;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(buildUi());
        refreshTasks();
    }

    private View buildUi() {
        int pad = dp(20);
        LinearLayout root = new LinearLayout(this);
        root.setOrientation(LinearLayout.VERTICAL);
        root.setPadding(pad, pad, pad, pad);
        root.setBackgroundColor(Color.rgb(248, 250, 252));

        TextView heading = text("Shadow Tasks", 28, Color.rgb(15, 23, 42));
        heading.setPadding(0, 0, 0, dp(16));
        root.addView(heading);

        endpoint = new EditText(this);
        endpoint.setHint("Demo API URL");
        endpoint.setSingleLine(true);
        SharedPreferences prefs = getSharedPreferences("settings", MODE_PRIVATE);
        endpoint.setText(prefs.getString("endpoint", BuildConfig.DEFAULT_API_URL));
        root.addView(endpoint, fullWidth());

        title = new EditText(this);
        title.setHint("Task title (ASCII for generic ADB input)");
        title.setSingleLine(true);
        root.addView(title, fullWidth());

        LinearLayout actions = new LinearLayout(this);
        actions.setOrientation(LinearLayout.HORIZONTAL);
        Button create = button("Create task");
        Button refresh = button("Refresh");
        create.setOnClickListener(v -> createTask());
        refresh.setOnClickListener(v -> refreshTasks());
        actions.addView(create, new LinearLayout.LayoutParams(0, dp(52), 1));
        actions.addView(refresh, new LinearLayout.LayoutParams(0, dp(52), 1));
        root.addView(actions, fullWidth());

        status = text("Ready", 14, Color.DKGRAY);
        status.setPadding(0, dp(12), 0, dp(12));
        root.addView(status);

        ScrollView scroll = new ScrollView(this);
        list = new LinearLayout(this);
        list.setOrientation(LinearLayout.VERTICAL);
        scroll.addView(list);
        root.addView(scroll, new LinearLayout.LayoutParams(-1, 0, 1));
        return root;
    }

    private void createTask() {
        String taskTitle = title.getText().toString().trim();
        if (taskTitle.isEmpty()) {
            Toast.makeText(this, "Enter a title", Toast.LENGTH_SHORT).show();
            return;
        }
        saveEndpoint();
        setStatus("Creating…");
        executor.execute(() -> {
            try {
                JSONObject body = new JSONObject();
                body.put("title", taskTitle);
                body.put("idempotencyKey", UUID.nameUUIDFromBytes(taskTitle.getBytes(StandardCharsets.UTF_8)).toString());
                request("POST", "/api/tasks", body.toString());
                main.post(() -> {
                    title.setText("");
                    setStatus("Created and verified by server");
                    refreshTasks();
                });
            } catch (Exception error) {
                main.post(() -> setStatus("Create failed: " + error.getMessage()));
            }
        });
    }

    private void refreshTasks() {
        saveEndpoint();
        setStatus("Loading…");
        executor.execute(() -> {
            try {
                JSONArray tasks = new JSONArray(request("GET", "/api/tasks", null));
                main.post(() -> renderTasks(tasks));
            } catch (Exception error) {
                main.post(() -> setStatus("Refresh failed: " + error.getMessage()));
            }
        });
    }

    private String request(String method, String route, String body) throws Exception {
        URL url = new URL(endpoint.getText().toString().replaceAll("/$", "") + route);
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setRequestMethod(method);
        connection.setConnectTimeout(4000);
        connection.setReadTimeout(4000);
        connection.setRequestProperty("Authorization", "Bearer " + BuildConfig.DEMO_API_TOKEN);
        connection.setRequestProperty("Content-Type", "application/json");
        if (body != null) {
            connection.setDoOutput(true);
            try (OutputStream stream = connection.getOutputStream()) {
                stream.write(body.getBytes(StandardCharsets.UTF_8));
            }
        }
        int code = connection.getResponseCode();
        if (code < 200 || code >= 300) throw new Exception("HTTP " + code);
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(connection.getInputStream()))) {
            StringBuilder result = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) result.append(line);
            return result.toString();
        } finally {
            connection.disconnect();
        }
    }

    private void renderTasks(JSONArray tasks) {
        list.removeAllViews();
        try {
            for (int i = tasks.length() - 1; i >= 0; i--) {
                JSONObject task = tasks.getJSONObject(i);
                TextView item = text("• " + task.getString("title") + "\n  " + task.getString("createdAt"), 17, Color.rgb(30, 41, 59));
                item.setPadding(dp(12), dp(12), dp(12), dp(12));
                item.setBackgroundColor(Color.WHITE);
                LinearLayout.LayoutParams params = fullWidth();
                params.setMargins(0, 0, 0, dp(8));
                list.addView(item, params);
            }
            setStatus(tasks.length() + " task(s), synced from server");
        } catch (Exception error) {
            setStatus("Render failed: " + error.getMessage());
        }
    }

    private void saveEndpoint() {
        getSharedPreferences("settings", MODE_PRIVATE).edit().putString("endpoint", endpoint.getText().toString().trim()).apply();
    }

    private void setStatus(String value) { status.setText(value); }
    private TextView text(String value, int size, int color) {
        TextView view = new TextView(this);
        view.setText(value);
        view.setTextSize(size);
        view.setTextColor(color);
        return view;
    }
    private Button button(String value) {
        Button view = new Button(this);
        view.setText(value);
        return view;
    }
    private LinearLayout.LayoutParams fullWidth() { return new LinearLayout.LayoutParams(-1, -2); }
    private int dp(int value) { return (int) (value * getResources().getDisplayMetrics().density); }
}
